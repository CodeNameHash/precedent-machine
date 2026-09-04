# The codebase guide

How this system actually works, from a filing on EDGAR to a row a lawyer
reads. Written for two readers at once: an intelligent person who has not
seen this repository and is a lawyer, not an engineer, and an agent that
needs to find the right file, function and command to make a change. Every
concept gets a plain-language explanation; alongside it, where one exists,
the file, the function, the exact command to run and the shape of the data.
A reader who only wants the first register can skip the code blocks and the
"Run it" / "Check it" lines without losing the argument.

## 0. What this document is, and what it deliberately does not repeat

This is an explanation, not an inventory. Every enumerable fact, the exact
list of registered families, product-projection modules, review table
configs, dark bridges, serving sources and live-run scripts, is not
committed to this repository as prose or JSON. Run `npm run
generate:codebase-inventory` (or `node
scripts/generate-codebase-inventory.js`) to derive it fresh from the
current code, every time you need it; the command writes its output to
`docs/codex-program/generated/system-inventory.json`, a generated file
that is deliberately not committed, so treat that path as something you
produce locally, not something to browse as checked-in. Where this guide
names a specific file or a specific count, it is either a permanent
architectural fact (a file that plays one fixed role) or is marked as
measured at the time of writing with the command that re-measures it. For
the full, current list of what exists in each layer, run the generator
above; this guide explains what the layers mean and why they are shaped
the way they are, and does not restate the generator's own output.

Three companion documents cover ground this one does not, and one of them
needs a correction stated plainly rather than left for a reader to discover:

- `docs/core/GRAVEYARD.md` catalogues code that was built, works,
  and is deliberately or accidentally unused, so a reader can tell "kept on
  purpose" from "safe to delete" from "still live but obscure".
- `docs/ARCHITECTURE.md` is a detailed, file-and-line-level reference, but
  **only for the older of the two pipelines described below, and it is
  stale**: its own header pins it to 15 July, three weeks before this
  document, and it does not mention Canonical V2 once (`grep -c
  "canonical-v2" docs/ARCHITECTURE.md` returns 0). Where this guide points
  at it for detail, that detail is real and still accurate for the older
  pipeline; it is not a pointer to Canonical V2 documentation, because none
  existed anywhere in this repository before section 5 below.
- `docs/codex-program/canonical-contracts.md` is the actual Canonical V2
  technical specification: 1,364 backticked identifiers across 21 sections,
  the binding target for identity, the write path, evidence, serving and
  query. It is authoritative and detailed, and, checked directly by
  extracting every backtick-quoted, extension-bearing token and counting the
  file-path-shaped ones (command below), it names **exactly one** file path,
  lib/schema/canonical/contract-v2/manifest.json, in over a megabyte of
  specification, and that one path does not exist (section 5.0). It says
  what the system must do and almost never where that is built. Section 5 of
  this guide is the map from that specification to the modules, functions
  and tests that implement it, including the parts that do not exist yet.

  ```
  grep -oE "\`[A-Za-z0-9_./-]+\.(js|mjs|jsx|json|sql)\`" \
    docs/codex-program/canonical-contracts.md | sort -u
  ```

**A note on trust.** This system has a documented history of governed
documents asserting things that were true when written and false by the
time they were read (`docs/codex-program/notes/doc-reality-audit.md`, 28
confirmed cases). Every specific number in this guide was measured against
the working tree at the time this document was written, not carried forward
from an earlier plan or a teammate's account. Where a number can drift on
its own (test counts, how many families have reached which stage), this
guide says how to re-measure it rather than asking to be trusted.

---

## 1. The system, in one paragraph

Precedent Machine takes a merger agreement filed with the SEC, works out
which parts of the document are which kind of legal provision (termination
rights, no-shop, representations, closing conditions, and so on), asks
Claude to read each one and extract specific, structured facts from it (a
dollar figure, a deadline, whether a knowledge qualifier is present), checks
those facts for basic soundness against the document's own words, stores
them, and renders them as a review page: one deal, laid out so a lawyer can
see, provision by provision, what the agreement actually says, with every
figure clickable back to the sentence it came from. The same stored facts
also feed a cross-deal search and comparison layer, so a lawyer can ask "what
did the last twenty deals do with reverse termination fees" and get an
answer built from the same extracted, cited facts, not from re-reading
twenty agreements.

---

## 2. Two pipelines in one app, and the names that will mislead you

There are two extraction-and-storage pipelines living in this repository at
once, built roughly a year apart, and the review page can show data from
either one, provision by provision. Knowing this before you read any code
is not optional; without it, file and directory names actively mislead.

**The older pipeline** ("V1" in this guide, called that in code and in
`docs/ARCHITECTURE.md`) is the one that has extracted and stored data for
the whole corpus. It is a single large Claude call per document section,
writing into three Postgres tables (`provisions`, `provision_cards`,
`claims`) that are joined to each other by matching text rather than by a
stable foreign key, because the first table is deleted and rebuilt on every
re-ingest. Section 4 of `docs/ARCHITECTURE.md` covers this in full; it is
not repeated here.

**The newer pipeline** ("Canonical V2", also called "M3" in the programme
documents under `docs/codex-program/`) is a rebuild of the same idea with a
normalised data model, content-derived identity that survives
re-extraction, and an explicit boundary between "the model proposed this"
and "the system has certified this as a governed fact". It has not
extracted the whole corpus. As of this writing it is fully wired into
production for exactly one family (termination fees, see section 4.7); every
other registered family has extraction and resolution code that passes its
own tests but has not been run against the live corpus and served on the
page. Section 4 of this guide is mostly about this pipeline; section 5 maps
it against its own governing specification, `docs/codex-program/
canonical-contracts.md`.

**Three naming collisions worth holding in your head before you read
further:**

1. **"review-v2" is not "canonical-v2".** `pages/review-v2/[id].js` is an
   18-line redirect stub, kept only so old bookmarks still work; it sends
   the browser straight to `/review/<id>`. The actual production review
   page is `pages/review/[id].js`, and the directory
   `components/review-v2/` holds its UI components (this is a UI redesign
   codenamed "Mergertrace", unrelated to the V1/Canonical V2 data
   distinction above). Reading "v2" in a component path tells you nothing
   about which data pipeline it renders; both V1 and Canonical V2 data flow
   through `components/review-v2/*` components today.
2. **"dark" does not mean broken.** Four modules with "dark bridge" in
   their purpose (see section 4.7) deliberately convert Canonical V2's
   normalised output into V1's card shape, for side-by-side preview only.
   "Dark" here means "never served to a real user", a status the code
   enforces, not a comment on quality.
3. **"review queue" means three different things** depending which part of
   the codebase you are in: the review page itself (what a lawyer opens),
   a GitHub-issue-backed worklist for flagging data problems
   (`lib/review-queue/`, `scripts/review-queue/`, general purpose, not
   specific to either pipeline), and a specific output array inside
   Canonical V2's resolution stage (section 4.5 below, section 6's
   glossary). This guide uses "review queue" only for the third meaning
   from here on, and says so again at the point it matters.

---

## 3. Why two pipelines, rather than a rewrite

This is worth explaining because it is not the obvious choice, and a reader
coming from ordinary software practice might expect a rewrite to replace
what it supersedes.

`docs/core/DECISIONS.md` item 3 records the actual ruling: Canonical
V2 replaces V1 one provision family at a time, in preview, and **V1 stays
visible beside V2 on the page rather than being switched off**, so that if
V2 gets a family wrong, a lawyer sees V1's answer right next to it with a
disagreement flagged, instead of silently trusting a wrong new answer or
seeing a blank field where V1 used to show something. Item 13 sharpens the
mechanism: a family only loses its V1 fallback once an automated
equivalence check (`scripts/review-parity-check.js`) has run V2 against the
same real corpus V1 has already been trusted on, and shown they agree, or
that V2 is demonstrably better. V1 is being used as the answer key for
grading V2, for as long as both are on the page; once V1 comes off for a
family, that check is no longer possible for it, which is precisely why the
bar for switching off V1 is proof against real data rather than proof
against hand-written test fixtures. A hand-written fixture only tests
whether the code agrees with whoever wrote the fixture's understanding of
the clause; the corpus V1 has been trusted on is a higher and more honest
bar.

The practical consequence for reading this codebase: expect to find, for
almost every provision family, a V1 code path that already works on the
whole corpus, and a Canonical V2 code path that may not yet be connected to
anything a real user can see. Both are "real" in the sense of being tested
and maintained; they are at different stages of the same rollout, not a
finished system next to an abandoned one.

---

## 4. The pipeline, end to end

### 4.1 From an EDGAR filing to clean text

A merger agreement arrives as an exhibit to an SEC filing, normally HTML.
V1's ingest path (`pages/api/ingest/from-url.js`, `lib/parser-v2/
text-layers.js`) fetches it, strips presentation artefacts, and hashes the
result; `docs/ARCHITECTURE.md` section 1 step 1 covers the detail (legacy
pipeline only, see section 0's correction).

Canonical V2 has its own admission path for the same job, built to a
stricter standard: every fetch is recorded as a receipt before anything
downstream is allowed to treat the text as admitted. The reason for the
stricter standard is direct: everything Canonical V2 later claims about a
document is only as trustworthy as the proof that the bytes it read are the
bytes SEC EDGAR actually served, and V1 predates that requirement being
made explicit.

- `lib/canonical-v2/sec-edgar-intake-capture.js` builds the fetch receipt.
  Its `CAPTURE_KEYS` are, in full: `schema_version`, `receipt_stage`,
  `authority_representation`, `source_host`, `retrieval_url_sha256`,
  `retrieved_at`, `retrieval_policy_digest`, `http_status`,
  `response_content_type`, `redirect_count`, `response_bytes_sha256`,
  `response_byte_length`, `response_bytes_base64`,
  `source_response_content_id`, `canonical_text_status`,
  `source_admission_status`, `intake_capture_receipt_id`. `SEC_SOURCE_HOST`
  is pinned to `www.sec.gov`.
- `lib/canonical-v2/sec-source-admission.js`'s
  `validateVerifiedSecSourceAdmission` is the gate the receipt above must
  pass before anything is treated as admitted.
- `lib/canonical-v2/admitted-semantic-source.js`'s
  `buildAdmittedSemanticSourceContext` and `buildAdmittedSourceReference`
  build the object every later stage (sectionizing, extraction, writing)
  actually receives: a source that carries its own proof of where it came
  from, not a bare string.

**Check it.** `node --test tests/canonical-v2-sec-edgar-intake-capture.test.js`
exercises the receipt builder directly. There is no live-network command to
run here on purpose: the whole point of this stage is that nothing
downstream trusts a fetch it cannot independently re-verify, and this
repository's own operating rules bar an agent from making a live fetch
outside a reviewed live-run script (section 4.4).

### 4.2 Splitting the document into sections

Both pipelines need to know where one provision ends and the next begins
before anything else can happen. `lib/parser-v2/structural.js`'s
`parseStructure` does this for V1 by regex and heading detection
(`docs/ARCHITECTURE.md` section 1 step 2, legacy pipeline only).

Canonical V2 does not re-implement this. `lib/canonical-v2/native-producer/
deterministic-sectionizer.js` **imports `parseStructure` directly** (its own
header states this plainly: "REQUIRED, imported, not copied") and wraps it
in `sectionizeAdmittedSource`, adding exact UTF-8 byte offsets into the
admitted document's original bytes, `SCHEMA_VERSION`-stamped output, and a
companion `findSectionByReference` lookup. So a "which sentence is this"
answer cannot silently differ between what V1 and Canonical V2 show side by
side: they run the same heading-detection code underneath. A defect in that
shared code is a defect once, not once per pipeline; `docs/codex-program/
notes/nested-lettering-collision.md` is a worked example of exactly that
kind of shared-mechanism bug (a lettered list running past "z" was
mis-parsed) being fixed once for both pipelines.

**Run it.** To see the section tree for admitted text directly:

```js
const { sectionizeAdmittedSource } = require('./lib/canonical-v2/native-producer/deterministic-sectionizer');
// sectionizeAdmittedSource({ admitted_source_context, ... }) returns the
// ordered section tree; see tests/canonical-v2-citation-constructibility.test.js
// for a worked call with real fixture text.
```

### 4.3 Deciding what a section is about

V1 assigns each section a provision-type code (`REP-T`, `NOSOL`, `COND`, and
so on) via a deterministic rule pass, falling back to a Claude call for
anything the rules do not confidently classify (`docs/ARCHITECTURE.md`
section 1 step 3, legacy pipeline only).

Canonical V2 has its own, coarser classification step:
`lib/canonical-v2/native-producer/section-family-classifier.js`'s
`classifySectionFamily` (the module's own top-level entry point; the file
also exports the narrower `classifyDeterministicSectionFamilies` /
`classifyDeterministicSectionFamily` stage-1 rule pass it is built on, and
the five possible classification-source constants:
`SECTION_FAMILY_RULE_CLASSIFIED`, `SECTION_FAMILY_DEFINED_TERM_ANCHORED`,
`SECTION_FAMILY_AI_CLASSIFIED`, `SECTION_FAMILY_MANIFEST_ASSIGNED`,
`SECTION_FAMILY_AI_UNVERIFIED`), sorting sections into one of 25 registered
**section families** such as `TERMINATION_FEE`, `NO_SHOP`, `MAE_DEFINITION`
or `MATERIAL_CONTRACTS` (the exact 25, and the module backing each one, are
in the generated inventory's `section_families` block, not repeated here).
A section family is coarser than a V1 provision-type code on purpose: it
exists only to answer "which producer prompt should read this section", one
decision, not to carry all the fine distinctions a claim will eventually
need.

**Check it.** `node --test tests/canonical-v2-section-family-classifier-quarantine.test.js`.

### 4.4 Extraction: one big call versus one prompt per family

V1 sends each classified section to a single large extraction routine
covering every provision type (`lib/parser-v2/extract.js`,
`docs/ARCHITECTURE.md` section 1 step 4, legacy pipeline only), returning
either free text or a `{code, label, text}` triple for features the rubric
marks as coded.

Canonical V2 instead dispatches each section, by its family, to one of 25
registered **producer prompts**, orchestrated by
`lib/canonical-v2/native-producer/native-extraction-run.js`'s
`runNativeExtraction`:

- **Dispatch.** `lib/canonical-v2/native-producer/
  producer-prompt-registry.js`'s `getProducerPromptModule(sectionFamily)` is
  the lookup: family in, a builder function out, or `null`, never a
  fallback. `listRegisteredSectionFamilies()` is the live, authoritative
  family list, and is what the generated inventory calls to build its own
  list, so the two can never silently disagree. Each entry is a plain
  `builder(section, governedScope) -> prompt` function, for example
  `buildTerminationFeeProducerPrompt` from `lib/canonical-v2/native-producer/
  termination-fee-producer-prompt.js`; adding a family means writing one
  such file and registering it here, in its own reviewed change, and
  nowhere else (the registry module's own header states this convention).
- **One model call per section**, scoped to that section's own text only
  (`governed_scope.source_text`, never the whole document): this is why
  `lib/canonical-v2/native-producer/native-write-set-adapter.js`, section
  4.7, has to convert evidence coordinates back to document-absolute before
  anything is written.
- **The result is a `compiled_candidate`, not a fact yet.** A producer
  prompt's job is narrower than V1's extractor: it proposes **candidates**,
  typed claims about one family's concepts, each carrying its own
  supporting quote and citation, without yet being allowed to assert that
  the candidate is correct, unique, or governed. Every compiled candidate
  also carries a `citation_validation` object
  (`{status, accepted, validation_source}`); an unaccepted citation is
  never force-passed later, it is carried forward as a fact for the
  resolver (section 4.5) to act on.
- `runNativeExtraction`'s own exports:
  `RUN_RECEIPT_SCHEMA`, `PARTIAL_RUN_RECEIPT_SCHEMA`, `GOVERNED_SCOPE_SCHEMA`,
  `EXTRACTOR_ID`, `EXTRACTOR_VERSION`, `NativeExtractionRunError`,
  `runNativeExtraction`. The registry fails closed by design: a section
  whose family has no registered producer is not force-fed to the nearest
  one; it is recorded in the run receipt's own `undispatched_sections`
  field and goes no further.

**Run it (dry, no model call).**

```js
const { listRegisteredSectionFamilies } = require('./lib/canonical-v2/native-producer/producer-prompt-registry');
console.log(listRegisteredSectionFamilies()); // the current 25, sorted
```

**Check it.** `node --test tests/canonical-v2-native-extraction-run.test.js`
runs the orchestrator against a fixture provider (no live model call, no
network, no credential; see that test's own header for how it substitutes a
pure function for the real Claude call). A genuine live call only ever
happens via `scripts/canonical-v2-live-extraction-run.mjs` (section 4.4's
live-run script), never inside the test suite.

### 4.5 Turning proposals into governed facts: resolution

This is the stage V1 has no equivalent of, and it is where most of
Canonical V2's engineering weight sits.
`lib/canonical-v2/native-producer/candidate-resolution.js`'s
`resolveCandidates` (one function, every family, ~90 exports in the module
in total, the generated inventory's `resolver` block has the full,
regenerated list) takes the producer's raw candidates and, deterministically,
with no further model call:

1. **Mints a provision.** Candidates are grouped by governing section,
   resolved concept and resolved party, and exactly one **provision
   instance** is minted per group, via `mintProvision`, which calls
   `lib/canonical-v2/source-structure.js`'s `buildProvisionInstance`
   (`source-structure.js:308-339`; section 5.2 traces this identity
   precisely against its governing specification). A candidate whose party
   cannot be mechanically determined gets no provision and is routed to the
   review queue with reason `PARTY_UNRESOLVED`, rather than guessed.
2. **Resolves the candidate's generic key against a governed vocabulary.**
   `GENERIC_CLAIM_KEY_RESOLUTION_TABLE` (`candidate-resolution.js:605`
   onward) is the one explicit, data-driven map from a producer's generic
   key to a registered `claim_definition_key`, inside a governing
   `concept_key`, from the supplied contract vocabulary (section 4.6
   explains what that vocabulary is). A generic key with no table entry, or
   a value the registered definition does not actually allow, is never
   forced onto the nearest registered key.
3. **Triages every resolved candidate into one of three outcomes,
   deterministically:** a candidate that reached a registered concept, a
   resolved party, a single unambiguous piece of governing evidence and no
   known-defect match auto-passes and becomes a `resolved` claim or
   relationship. Anything that reached a registered concept but failed one
   of those checks (an ambiguous span, an unresolved citation, a
   materiality flag) goes to the **review queue**, ranked by
   `MATERIALITY_TABLE` (`candidate-resolution.js:1070` onward; rank 10 is
   `TERMINATION_RIGHTS`, rank 20 is `FEES`, and so on down to the lowest
   priority) so a reviewer's time goes to a termination-right dispute before
   a boilerplate notice clause. Anything whose generic key has no registered
   mapping at all goes to **open world** instead (defined precisely in
   section 6).

The output of this stage is a single object with three arrays,
`resolved` / `review_queue` / `open_world`
(`candidate-resolution.js:9988-9990`; the sibling `counts` block at
`candidate-resolution.js:9933` totals each, plus `residuals` for compiler
failures), the single most important shape in the whole Canonical V2 system
to hold in your head: every extracted fact ends up in exactly one of those
three buckets, and which bucket it is in is a legal-trustworthiness
statement, not an implementation detail.

**Check it.** `node --test tests/canonical-v2-candidate-resolution.test.js`.
To widen what a family's producer can express: add a row to
`GENERIC_CLAIM_KEY_RESOLUTION_TABLE` in `candidate-resolution.js`, and
confirm the target `claim_definition_key` already exists in the contract
bundle (section 4.6); resolution refuses to invent one.

### 4.6 The contract vocabulary

Resolution needs something to resolve against: a closed list of which
concepts, claim definitions, components and relationships the system
currently understands, each one versioned. That list is called the
**contract bundle** (or contract vocabulary) and is compiled by
`lib/canonical-v2/contract-bundle.js`. As of this writing it is a frozen
JavaScript object literal inside that file (`FIXTURE_CONTRACT_INPUT_V1`,
the default `compileFixtureContract()` compiles unless told otherwise, with
later versions, `V2` through `V38` at the time of writing (`grep -o
"compileFixtureContractV[0-9]*" lib/canonical-v2/contract-bundle.js | sort
-u -V` to re-count), added alongside it as separate constants, never
replacing it, so that anything already reviewed against an earlier version
keeps a stable target), not a JSON manifest on disk; an earlier plan to make
the manifest the sole editable source was never built, and no document
should be trusted if it says otherwise. Its top-level shape, `V1`'s, the
default:

```js
{
  schema_version: 'FIXTURE_CONTRACT_INPUT/V1',
  contract_key: 'CANONICAL_V2_VERTICAL_SLICE',
  concepts: [{ concept_key: 'TERMF-TARGET', version: 1 }, /* ... */],
  component_definitions: [{ component_key: 'FEE_AMOUNT_LIMB', version: 1 }, /* ... */],
  relationship_definitions: [
    { relationship_key: 'BRINGS_DOWN', effect_mode: 'TYPED_LEGAL_EFFECT', version: 1 },
    { relationship_key: 'CONTAINED_IN', effect_mode: 'NON_SEMANTIC', version: 1 },
    /* EXCEPTED_BY, TRIGGERED_BY, USES_DEFINITION, at the time of writing five in total */
  ],
  claim_definitions: [
    {
      claim_definition_key: 'IOC_CAPEX_THRESHOLD_PERCENT_OF_DEAL_VALUE',
      version: 1,
      canonical_value_type: 'NON_NEGATIVE_DECIMAL_STRING',
      canonical_value_required_when_present: true,
    },
    /* ... */
  ],
}
```

A candidate resolves only against concepts, components and claim
definitions that are actually listed in this bundle; adding a new
legally-meaningful distinction always means adding it here first, in its own
reviewed change, then a row in `GENERIC_CLAIM_KEY_RESOLUTION_TABLE` (section
4.5) to let a producer's proposal actually reach it.

**Check it.** `node --test tests/canonical-v2-contract-bundle-versions.test.js`
pins that every version compiles and that later versions add to, never
silently replace, an earlier one.

### 4.7 Writing it down

V1 writes directly to three Postgres tables on every ingest, deleting and
re-inserting `provisions` wholesale each time (`docs/ARCHITECTURE.md`
section 1 step 5 and section 2, legacy pipeline only). This is why V1 needs
a fuzzy text-matching ladder to re-attach human corrections and annotations
after every re-ingest: the row identity a correction pointed at no longer
exists.

Canonical V2 does not have that problem, by construction. Resolution's
output is assembled into a **write set**, a single object whose keys are
fixed, in a fixed order:

```js
// lib/canonical-v2/canonical-writer.js
const WRITE_ORDER = [
  'excerpts', 'validated_semantic_graphs', 'definition_occurrences',
  'provisions', 'components', 'condition_groups', 'claims', 'relationships',
  'open_world_candidates', 'open_world_candidate_occurrences',
  'open_world_evidence_references', 'open_world_candidate_dispositions',
  'open_world_primitives', 'semantic_impact_closures',
  'reviewed_source_specific_rows', 'incomplete_canonical_result_rows',
];
const ALLOWED_OPERATIONS = [
  'FIXTURE_DEAL_EXTRACTION_RUN', 'INTAKE_CAPTURE', 'STAGE_SOURCE_ARTIFACT_CHUNK',
  'PREPARE_SOURCE_ADMISSION', 'DEAL_SCOPE_RUN', 'PRODUCT_RESULT_CANDIDATE_RUN',
];
```

`lib/canonical-v2/canonical-writer.js`'s `OBJECT_ID_FIELDS` pairs every
member of `WRITE_ORDER` with its own identity field (`provisions` ->
`provision_instance_id`, `claims` -> `claim_revision_id`, and so on); every
member of it, plus its identity field, is what `canonical-writer.js`
actually validates (via `lib/canonical-v2/validate-write-set.js`'s
`validateResolvedCanonicalWriteSet`) before accepting a write. Everything in
a write set carries **occurrence identity**: an ID computed from what the
fact is about and which slot it fills, never from a database sequence and
never from the fact's own answer (section 6 defines this precisely, section
5.2 traces the exact fields hashed; it is the direct architectural fix for
V1's row-identity problem above).
`lib/canonical-v2/native-producer/native-write-set-adapter.js` is the one
place resolution's section-local evidence coordinates get converted into
document-absolute ones and every dependent identity gets recomputed from
the result, specifically so a downstream row can never end up asserting an
identity that does not match the text it actually points at.

`lib/canonical-v2/canonical-writer.js` validates a write set against
`supabase/canonical-v2-foundation.sql`, an 8,686-line schema covering every
collection above, and the actual database-side entry point the schema
defines is a Postgres `SECURITY DEFINER` function, `public.canonical_v2_write`
(section 5.6 maps this against its own specification precisely). As of this
writing, this schema has never been applied to a live database, staging or
production; see `docs/core/GRAVEYARD.md` for exactly how
thoroughly it is tested despite that, and what would need to happen to
actually run it. Every extraction described in this guide up to this point
is fully exercised by the test suite; this specific step, real persistence,
is the one still unproven against a real database.

**Check it.** `node --test tests/canonical-v2-canonical-writer.test.js` and
`node --test tests/canonical-v2-native-write-set-adapter.test.js`.

### 4.8 From stored facts to a screen

For a family with governed, resolved claims, `lib/canonical-v2/*-product-
projection.js` reshapes them into the specific fields a review page or a
query result needs; each such file's own exported function follows the
naming pattern `project<Family>ProductSurfaces` or
`project<Family>Claims` (for example `projectTerminationFeeProductSurfaces`,
`lib/canonical-v2/termination-product-projection.js`). The generated
inventory's `product_projections` block lists every projection module, its
full export list, and, for each, whether anything **outside its own tests**
currently imports it (computed from the real `require()` graph, not a text
search on names; see that block's own `method` field for exactly how). A
projection existing does not mean a lawyer can see its output; two more
gates sit between a projection and a screen:

- **Dark bridges** (four of them; `lib/canonical-v2/dark-bridge-gate.js`'s
  `assertDarkBridgeIntegrationAllowed` is the shared gate every one of them
  calls as its first statement, `docs/core/OPERATING-RULES.md`'s
  "ADR-001" section is the fullest account) flatten a projection's
  normalised shape into V1's denormalised card shape, so the two can be
  shown side by side without rewriting the renderer, and so a human
  reviewer can eyeball agreement before anything is trusted. A dark bridge
  is disabled by default everywhere, including in production
  (`lib/canonical-v2/dark-bridge-gate.js`'s gate requires the exact
  environment value `CANONICAL_V2_DARK_BRIDGE=ENABLED_LOCAL_PREPRODUCTION`,
  a non-production runtime per `lib/canonical-v2/feature-flags.js`'s
  `isPermittedCanonicalV2Runtime`, and refuses outright if `CI` is truthy);
  the ruling recorded in OPERATING-RULES.md is direct: "Flattened cards must
  not be written to the production card table, the claims table, or any
  other persistent store, ever." A dark bridge is preview tooling,
  permanently, not a slower path to the same destination. The four leaf
  bridges, by the family each covers: `lib/canonical-v2/legacy-card-bridge.js`
  (Material Contracts, despite its generic-sounding name),
  `lib/canonical-v2/general-covenants-dark-bridge.js`,
  `lib/canonical-v2/no-other-reps-fraud-dark-bridge.js`,
  `lib/canonical-v2/representations-dark-bridge.js`.
  `lib/canonical-v2/review-preview-assembly.js`'s `attachCanonicalV2Preview`
  aggregates all four for the one served route that reads them
  (`pages/api/review/[id]/cards.js`, section 4.9).
- **Serving sources** are the other, real path: a per-family module
  (`lib/canonical-v2/*-serving-source.js`) that decides, for a specific
  family, whether Canonical V2's own data is trustworthy enough to be the
  thing a real user is actually served, gated by its own environment
  variable, separate from the dark-bridge gate. As of this writing two such
  modules exist: `lib/canonical-v2/termination-fee-serving-source.js` (see
  the worked example below for what "serving" means concretely), and
  `lib/canonical-v2/termination-rights-review-serving-source.js`, called
  from the same route (`pages/api/review/[id]/cards.js`) immediately after
  it. The latter's default registry for five preview deal ids compiles a
  synthetic fixture rather than a real agreement analysis, and is
  quarantined by an `isAdmittedRealAgreementAnalysis` gate (refuses with an
  HTTP 410 rather than serve it) — `docs/core/GRAVEYARD.md` entry 17 has the
  full account. This is the "cheap pattern" DECISIONS.md item 13 chose over a
  more elaborate, partially-built certification chain for the same purpose
  (the metric-scoped serving-admission chain); that chain is described, and
  its status explained, in `docs/core/GRAVEYARD.md` entry 1.

**Check it.** `node --test tests/canonical-v2-parity-serving-boundary.test.js`
exercises the dark-bridge and serving-source boundary together.

### 4.9 The worked example: how a termination fee actually reaches a lawyer today

This is the one family where every step above is real, wired, and running,
so it is worth tracing concretely rather than abstractly. The whole chain
is in `pages/api/review/[id]/cards.js`:

1. `fetchReviewDealCards` (`lib/queries/review-deal.js`) builds the V1
   review deal (cards and claims, section 4.7's older path) for the
   requested deal.
2. `attachCanonicalV2Preview` (the dark-bridge aggregator,
   `lib/canonical-v2/review-preview-assembly.js`) attaches preview data if,
   and only if, the dark-bridge gate is open; in production it is not, so
   this is a same-reference no-op.
3. `attachCanonicalTerminationFeeServing`
   (`lib/canonical-v2/termination-fee-serving-source.js`) separately checks
   its own, unrelated environment gate. If open, it reads Canonical V2's
   resolved termination-fee data for this deal and stamps two extra fields
   onto the payload: a boolean flag,
   `canonical_v2_termination_fee_serving_enabled`, and the actual card data,
   `canonical_v2_termination_fee_cards`.
4. `trimReviewDealForWire`'s `trimCardForWire` / `trimReviewDealForWire`
   (`lib/queries/review-deal-wire.js`) is an explicit allowlist of exactly
   which fields are allowed onto the wire; the two fields above are on it by
   name.
5. The browser receives JSON containing, among the ordinary V1 fields, the
   serving flag and (if set) the Canonical V2 card data.
6. `components/review/table-configs/termination-fees.config.js` reads that
   flag **client-side**, and picks the V1 card set or the Canonical V2 card
   set for its rows, never both merged: the same file's own comment
   explains why mixing them silently would produce an order-dependent
   hybrid figure (a canonical amount next to a legacy percentage and a
   legacy deadline, changing with array order), corrupting the exact number
   a reader relies on.
7. That config's rows render inside `components/review/ProvisionTable.jsx`, on
   `pages/review/[id].js`, the page a lawyer actually has open.

One detail worth naming because it looks like an oversight and is not: the
table config never imports `lib/canonical-v2/termination-fee-serving-source.js`
directly. The serving module reads `node:fs` and touches the write-set
projection pipeline, code that can only run on the server; the table config
is bundled into the browser. So the config **re-declares** the serving
module's field names as literal strings (`CANONICAL_V2_TERMINATION_FEE_
SERVING_FIELD`, `CANONICAL_V2_TERMINATION_FEE_CARDS_FIELD`,
`CANONICAL_V2_TERMINATION_FEE_COMPARE_FIELD`), with a comment pointing at
the module they must agree with, and a dedicated test
(`tests/canonical-v2-termination-fee-serving-switch.test.js`) pins that the
two declarations do not drift apart. This is the general pattern for
crossing the server/client boundary in this codebase: a shared constant
where one side cannot literally `require()` the other, verified by a test
rather than by a shared import.

**Check it, end to end.** `node --test tests/canonical-v2-termination-fee-both-sources.test.js`
exercises the flag-driven switch itself; `node --test
tests/canonical-v2-parity-serving-boundary.test.js` proves it agrees with the
dark-bridge boundary above.

### 4.10 Beyond one deal

The same stored facts, from either pipeline, feed a cross-deal layer:
`lib/query/` compiles a handful of query kinds (provision cross-cut across
every deal, market-range distributions, filter-and-list, and deal-to-deal
comparison, which now renders as extra columns on the ordinary review page
rather than a separate screen) over the corpus, exposed through
`pages/api/query/run.js` and `pages/api/query/kinds.js`. Canonical V2's own
governed query surface is `lib/canonical-v2/product-query-result-compiler.js`
and its sibling `product-query-*.js` modules, gated the same way the review
API is (`lib/canonical-v2/feature-flags.js`); section 5.8 maps this against
its own specification, including the parts of that specification with no
implementation found. This guide does not otherwise cover that layer in
depth; it consumes the pipeline described above rather than adding a third
one.

---

## 5. The Canonical V2 contract-to-code map

`docs/codex-program/canonical-contracts.md` (1,013,733 bytes; do not open it
whole, see the note at the end of this section for how to read a specific
part of it) is the binding target specification for Canonical V2: eight
numbered core sections (0 to 8) plus later phase-specific sections. It is
detailed and precise about what every object must be; checked directly, it
names almost no code. This section is the missing other half: for each
specification section, what actually implements it, and, as often, what
does not exist at all. Where the specification and the implementation use
different field or identifier names for the same concept, both names are
given, because a reader searching the codebase for the specification's own
vocabulary will otherwise find nothing.

**The overall relationship, stated once rather than per section below.**
Sections 0, 1, 2 and 5 of the specification are implemented closely: the
identity mechanics, the source-admission mechanics and the span/containment
rules in code match what the specification describes, field for field, in
the places checked below. Sections 3, 4, 6, 7 and 8 each describe a real,
working core (claims, relationships, the writer, serving, query) **plus** a
substantially larger surrounding governance and certification apparatus
(independent adversarial re-derivation of discovery, cryptographically
signed reviewer trust registries, query golden-suite certification,
release-bundle promotion fencing) that, as far as a direct search of `lib/`,
`scripts/`, `pages/` and `components/` can find, has no implementation
anywhere in this repository. That is not a defect in either document: the
specification is a target architecture, stated as "Binding target
architecture" in its own heading, and DECISIONS.md item 13 records a
deliberate choice to build a cheaper, working mechanism first (per-family
serving sources plus a corpus equivalence check) rather than the fuller
certification chain the specification also describes. It is, however, a gap
worth naming precisely: a reader of the specification alone would
reasonably believe more of this exists than does.

### 5.0 Section 0: One authoritative contract source

**Specification** (`canonical-contracts.md:7-906`): a single, digest-listed,
authoritative source compiles into `CanonicalContractBundle`.

**Implementation.** `lib/canonical-v2/contract-bundle.js`'s
`FIXTURE_CONTRACT_INPUT_V1` and its later versioned siblings (section 4.6
above has the exact shape and the versioning convention). **Confirmed gap,
already independently found and worth repeating here because an agent
grepping for the specification's own words will hit it first**: the
specification's own line 8 to 9 names `lib/schema/canonical/
contract-v2/manifest.json` as "the sole editable authority"; that path does
not exist anywhere in this repository (`ls lib/schema/canonical` fails).
The actual authority is the hardcoded object literal named above. Do not
create the manifest file to "fix" this without a decision to actually
migrate the bundle to it; `contract-bundle.js` is what every other module in
this map actually reads.

**Test.** `tests/canonical-v2-contract-bundle-versions.test.js`.

### 5.1 Section 1: Immutable source and deterministic structure

**Specification** (`canonical-contracts.md:906-1927`): `SourceContent`
(exact received bytes, content-addressed by kind, byte length and SHA-256),
`ImmutableSourceDocument` (the extraction boundary object), and, further
into the section, `SemanticInferenceTranscript` and `ReviewedInferencePayload`
as the specified record of a model attempt and its human-reviewed
selection.

**Implementation.** `SourceContent` / `ImmutableSourceDocument` map to
`lib/canonical-v2/source-structure.js`'s `buildImmutableSource` and to the
intake/admission chain in section 4.1 above
(`sec-edgar-intake-capture.js`, `sec-source-admission.js`,
`admitted-semantic-source.js`). **Confirmed gap:** `SemanticInferenceTranscript`
and `ReviewedInferencePayload` as named, typed objects with their own
content-addressed identity were not found anywhere in `lib/canonical-v2`
(`grep -rl "SemanticInferenceTranscript\|ReviewedInferencePayload" lib/`
returns nothing). What exists instead is plainer: `native-extraction-run.js`
records a `run_receipt` with `compiled_candidates` and a
`citation_validation` per candidate (section 4.4); there is no separate,
independently identified transcript object per model attempt, and no
distinct "reviewed payload" object between the raw model output and the
resolver's input.

**Test.** `tests/canonical-v2-sec-edgar-intake-capture.test.js`,
`tests/canonical-v2-admitted-semantic-source.test.js`.

### 5.2 Section 2: Definitions-first semantic objects and stable identity

**Specification** (`canonical-contracts.md:1927-2020`): provision identity
is anchored to the tuple `(source_occurrence_id, canonical_text_id,
document_hash, absolute_start, absolute_end, concept_key, party, ordinal)`,
where party is the full `{role, value, capacity}` tuple. It also specifies
`DefinitionCue`/`DefinitionUseCue` (definitions detected before they are
matched to a governed concept), `SourceClassificationSlot` and
`ScopeAssessmentOccurrence`.

**Implementation, verified field for field.**
`lib/canonical-v2/source-structure.js:308-339`'s `buildProvisionInstance`:

```js
const payload = {
  schema_version: 'PROVISION_INSTANCE/V1',
  source_occurrence_id: source.source_occurrence_id,
  canonical_text_id: source.canonical_text_id,
  document_hash: source.document_hash,
  absolute_start: span.absolute_start,
  absolute_end: span.absolute_end,
  concept_key: conceptKey,
  party: { role: party.role, value: party.value, capacity: party.capacity },
  ordinal,
};
provision_instance_id = contentId('PROVISION_INSTANCE/V1', payload);
```

This is an exact match to the specification's own tuple, field for field,
in the order the specification names them. `DefinitionCue` /
`DefinitionUseCue` map to `lib/canonical-v2/definition-graph.js`'s
`validateValidatedDefinitionGraph` (called from
`lib/canonical-v2/validate-write-set.js`). **Confirmed gap:**
`SourceClassificationSlot` and `ScopeAssessmentOccurrence` were not found
anywhere (`grep -rl "SourceClassificationSlot\|ScopeAssessmentOccurrence"
lib/` returns nothing); there is no implemented mechanism for retargeting a
reviewed classification change independently of a concept/party decision,
and no implemented whole-concept assessment occurrence distinct from an
ordinary provision.

**Test.** `tests/canonical-v2-structural-provision-instance.test.js`,
`tests/canonical-v2-canonical-writer.test.js`.

### 5.3 Section 3: Typed claims, evidence and explicit states

**Specification** (`canonical-contracts.md:2020-3401`): a `ClaimRevision`'s
identity hashes claim occurrence, `ScopeAssessmentRevision` ID,
`ClaimScopeClosure` ID, ordered dependency-discharging `RelationshipRevision`
IDs, expected-claim-slot key, state, values, evidence edges, and applied
`CorrectionApplication` IDs. State is exactly one of `PRESENT`, `ABSENT`,
`NOT_APPLICABLE`, `NOT_EXAMINED` or `FAILED`. Evidence roles are
`OPERATIVE_TEXT`, `DEFINITION`, `EXCEPTION`, `CROSS_REFERENCE`,
`DERIVATION_INPUT`. The bulk of this section (roughly 2020-3300, well over
half its length) specifies a `LegalSemanticReviewPolicy` /
`LegalReviewerTrustRegistry` / `LegalReviewerRevocationHead` authority
framework and a three-path independent challenger/discovery/reconciliation
process (`IndependentSemanticChallengeManifest`, `ChallengeBaseSubject`,
`IndependentLegalDimensionDiscoveryManifest`) for certifying that discovery
itself was not biased by the ordinary extraction catalogue.

**Implementation, verified field for field, for the part that is built.**
`lib/canonical-v2/claims-relationships.js:321-343` computes
`claim_revision_id = contentId('CLAIM_REVISION/V1', revisionPayload)` where
`revisionPayload` is exactly: `claim_occurrence_id`, `subject_occurrence_id`,
`claim_definition_key`, `claim_definition_version`, `ordinal`, `state`,
`raw_value`, `canonical_value`, `unit`, `day_basis`, `denominator`, `scope`,
`applicability`, `not_examined`, `failure`, `evidence_ids`, `attributes`,
`taxonomy_codes`, `extraction_version`, `normalisation_version`,
`derivation_version`. `CLAIM_STATES` (same file) is exactly the five states
named above. `EVIDENCE_ROLES` is exactly the five roles named above. The
claim occurrence identity underneath it,
`claim_occurrence_id = contentId('CLAIM_OCCURRENCE/V1', {subject_occurrence_id,
claim_definition_key, claim_definition_version, ordinal})`
(`claims-relationships.js:304-308`), is the section 2 identity pattern
applied to claims. `candidate-resolution.js`'s own header describes exactly
this scope narrowing in its own words: it triages "the subset this
deterministic stage can actually decide (no v1/v2 comparator, no
lexical-disagreement net, no sampling, those live elsewhere in the full
protocol)".

**Confirmed gap, the largest in this map.** `ScopeAssessmentRevision`,
`ClaimScopeClosure`, `ClaimScopeDefinition`, `LegalSemanticReviewPolicy`,
`LegalReviewerTrustRegistry`, `LegalReviewerRevocationHead`,
`IndependentSemanticChallengeManifest`, `ChallengeBaseSubject` and
`IndependentLegalDimensionDiscoveryManifest` were each searched for
individually (`grep -rl "<name>" lib/canonical-v2/*.js
lib/canonical-v2/native-producer/*.js`) and every one returns zero files.
`CorrectionApplication` returns one file, `lib/canonical-v2/
candidate-release.js`, unconnected to `claim_revision_id`'s own computation
above. None of the independent-challenger, reviewer-trust-registry or
signed-revocation machinery this section spends most of its length on has
been built. What is built is the deterministic value/evidence/state core:
real, tested, and narrower than the specification, exactly as
`candidate-resolution.js`'s own header says.

**Test.** `tests/canonical-v2-canonical-writer.test.js` (exercises claim
identity through the writer); `grep -rl "CLAIM_STATES\|EVIDENCE_ROLES"
tests/` for the full set of consumers.

### 5.4 Section 4: Typed relationships and multi-span result composition

**Specification** (`canonical-contracts.md:3401-4151`): `RelationshipDefinition`
governs nine typed edges: `CONTAINED_IN`, `USES_DEFINITION`, `APPLIES_TO`,
`BRINGS_DOWN`, `EXCEPTED_BY`, `GOVERNS`, `ENFORCED_BY`, `TRIGGERS_REMEDY`,
`MIRRORS`. Most of the rest of the section specifies a
`RelationshipEffectFieldUniverse` / `RelationshipEffectConstraint` apparatus
built on the same independent-catalogue-reconciliation machinery as section
3.

**Implementation.** `lib/canonical-v2/claims-relationships.js:374`'s
`relationshipOccurrenceId = contentId('RELATIONSHIP_OCCURRENCE/V1',
{source_occurrence_id, relationship_definition_key,
relationship_definition_version, ordinal})`, the same identity pattern as
claims. The governed relationship vocabulary today (section 4.6's contract
bundle) is five keys, not nine: `BRINGS_DOWN`, `CONTAINED_IN`, `EXCEPTED_BY`,
`TRIGGERED_BY`, `USES_DEFINITION`. Two are missing outright from the
specification's nine (`APPLIES_TO`, `GOVERNS`, `ENFORCED_BY`, `MIRRORS` have
no governed key at all today), and one is named differently:
`TRIGGERED_BY` (implemented) versus `TRIGGERS_REMEDY` (specified); these do
not appear to be the same key under two names so much as a narrower,
differently-shaped relationship built for the termination-fee family
specifically. **Confirmed gap:** `RelationshipEffectFieldUniverse` and
`RelationshipEffectConstraint` were not found anywhere in `lib/`.

**Test.** `tests/canonical-v2-canonical-writer.test.js`.

### 5.5 Section 5: Nested and overlapping spans

**Specification** (`canonical-contracts.md:4151-4170`): structural leaf
spans are a non-overlapping partition; semantic and evidence spans are an
interval graph and may nest, joined by `CONTAINED_IN`.

**Implementation.** Matches directly: `CONTAINED_IN` is a real, governed
relationship key (section 5.4 above), `effect_mode: 'NON_SEMANTIC'` in the
contract bundle (section 4.6), meaning it proves geometry only and carries
no legal effect of its own, exactly as specified.

**Test.** `tests/canonical-v2-canonical-writer.test.js` (relationship
validation is shared across the write path, there is no span-specific test
file).

### 5.6 Section 6: One writer, candidate releases and corrections

**Specification** (`canonical-contracts.md:4170-8519`, by far the longest
section): one authoritative `canonical_write` Postgres `SECURITY DEFINER`
RPC with a closed operation set,
`CONTRACT_FREEZE, INTAKE_CAPTURE, INTAKE_CUTOFF_BUILD, DEAL_SCOPE_RUN,
CORPUS_SCOPE_FREEZE, CORRECTION_APPLY, DEAL_EXTRACTION_RUN,
CANDIDATE_RELEASE_FREEZE, RELEASE_BUNDLE_CONTROL_BUILD,
CERTIFIED_RELEASE_IMPORT_BATCH`; all canonical tables deny direct DML to
every role except that function. The bulk of the section specifies a
`ReleaseBundleControlPolicy` / `ReleaseBundleControlHead` / promotion-fence
apparatus for candidate releases.

**Implementation, in two layers, easy to conflate and worth keeping
separate.** (1) `supabase/canonical-v2-foundation.sql` defines the real
Postgres function, named `public.canonical_v2_write` (a "v2" infix the
specification's own prose does not use), `SECURITY DEFINER`, matching the
specification's basic shape; per `docs/core/GRAVEYARD.md` entry 4
it has never been applied to a live database. (2)
`lib/canonical-v2/canonical-writer.js` is a **JavaScript pre-validator**
that runs before that RPC would ever be called; its own `ALLOWED_OPERATIONS`
(section 4.7 above) has six values, of which exactly two,
`INTAKE_CAPTURE` and `DEAL_SCOPE_RUN`, match the specification's ten
verbatim. The other four
(`FIXTURE_DEAL_EXTRACTION_RUN`, `STAGE_SOURCE_ARTIFACT_CHUNK`,
`PREPARE_SOURCE_ADMISSION`, `PRODUCT_RESULT_CANDIDATE_RUN`) are not named in
the specification at all; the `FIXTURE_` prefix on the extraction-run
operation is itself a signal that even the JS validator's own operation set
is scoped to fixture/staging use, not the production RPC surface the
specification describes.

`CandidateReleaseManifest` and the offline release/import surface map to
`lib/canonical-v2/candidate-release.js` and `lib/canonical-v2/
candidate-release-import.js`; per `docs/core/GRAVEYARD.md` entries
6 and 7 these are real and heavily used, but only by the offline QXO staging
pipeline (`scripts/canonical-v2-staging-*.mjs`), never by anything reachable
from a served page. **Confirmed gap, already independently confirmed in
DECISIONS.md item 9 and re-checked directly for this map**: `grep -rl
"ReleaseBundleEnvelope\|PostActivationControlHead\|CandidatePromotionFence\|
GeneratedLockPlanRegistry" lib/ scripts/ pages/ components/` returns zero
files for all four. The release-bundle promotion-fence apparatus this
section spends most of its length on, and the specific objects DECISIONS.md
item 9 names as blocking a full 25-step production cutover, do not exist in
code.

**Test.** `tests/canonical-v2-canonical-writer.test.js`,
`tests/canonical-v2-candidate-release-import.test.js`.

### 5.7 Section 7: Serving projection and one row contract

**Specification** (`canonical-contracts.md:8519-9265`): canonical serving
identities are domain-separated digests, never allocated database IDs or
display order. `market_observation_serving_key`, `result_row_serving_key`,
`reviewed_source_specific_row_serving_key` and
`incomplete_result_review_row_serving_key` are each specified precisely, all
keyed by a `CorpusRelease` ID plus an occurrence ID, never by anything
positional.

**Implementation.** The naming match is exact for two of the four:
`lib/canonical-v2/canonical-writer.js`'s `OBJECT_ID_FIELDS` (section 4.7)
includes `reviewed_source_specific_rows:
'reviewed_source_specific_row_serving_key'` and
`incomplete_canonical_result_rows: 'incomplete_result_review_row_serving_key'`,
verbatim. The generic serving-layer modules
(`lib/canonical-v2/serving-projection.js`, `serving-client.js`,
`serving-projection-contract.js`, `product-query-result-serving-record.js`,
`product-query-result-active-serving.js`; the generated inventory's
`serving_sources.generic_serving_infrastructure` block has the full,
regenerated list) implement pieces of this layer;
`lib/canonical-v2/serving-projection.js`'s
`METRIC_DEFINITIONS` and `metricDefinitionId` are the closest match to this
section's `market_observation` identity concept, though not confirmed field
for field against the specification's exact hash inputs in this pass (a
narrower, more precise trace than sections 5.2 to 5.4 above; treat this
specific claim as less certain than those). The one family with a genuinely
served row, termination fees (section 4.9), does not go through this
generic serving-key layer at all: it is served through the simpler,
per-family serving-source pattern DECISIONS.md item 13 chose instead.

**Test.** `tests/canonical-v2-parity-serving-boundary.test.js`.

### 5.8 Section 8: Governed query compiler and fast result delivery

**Never hand-edit `lib/query/serving-registry-v1.json`. Fix it through its
generator.** A hand edit passes a naive test and the next regeneration
reinstates every error, so the fix looks done, ships, and silently reverts.
This was the whole reason the retired Step 8B insisted on the generator route,
and it is recorded here because it is a live constraint on anyone touching the
registry rather than a fact about a closed step. The registry itself is
currently correct: **0 of 699 entries shadowed**, measured 2026-08-07, against
that step's claim of 104.

**Specification** (`canonical-contracts.md:9265-9976`): a `QueryDefinitionSetRoot`
inventories the complete closed query contract; a `QueryGoldenSuiteManifest`
of human-reviewed golden fixtures (`DATABASE_API` and
`CLIENT_ONLY_NO_SQL_NO_API` variants) is certified by a
`QueryGoldenCertificationAttestation` before any query route may serve.

**Implementation.** The live, working query layer is `lib/query/`
(section 4.10), exposed through `pages/api/query/run.js` and
`pages/api/query/kinds.js`, and, on the Canonical V2 side,
`lib/canonical-v2/product-query-result-compiler.js` and its sibling
`product-query-*.js` modules (`product-query-ir.js`,
`product-query-result-set-compiler.js`, `product-query-contract-input-
validator.js`; the generated inventory does not currently enumerate this
family, since it is outside the seven categories that document derives, see
its own header for why). **Confirmed gap:** `QueryDefinitionSetRoot`,
`QueryGoldenSuiteManifest` and `QueryGoldenCertificationAttestation` as
named, certified objects were not found anywhere in `lib/`
(`grep -rl "QueryDefinitionSetRoot\|QueryGoldenSuiteManifest\|
QueryGoldenCertificationAttestation" lib/` returns nothing). There is a real
golden-fixture concept elsewhere in this repository, `eval/goldens.json`
plus `scripts/eval.js` (`docs/ARCHITECTURE.md` section 4, legacy pipeline),
but it is unconnected to this specification's query-certification design and
covers extraction quality, not query-route certification.

**Test.** No dedicated Canonical V2 query-compiler test file was found by
name; `grep -rl "product-query-result-compiler" tests/` to find current
consumers.

**How to extend this map.** Read the specification's headings first
(`grep -n "^#\{1,4\} " docs/codex-program/canonical-contracts.md`), then
read only the section you need with `Read` at a bounded `offset`/`limit`
against those line numbers, never the whole file. Cross-check any object
name it defines with `grep -rl "<ExactName>" lib/ scripts/ pages/
components/`; a zero-result grep is itself the finding, exactly as used
throughout this section.

---

## 6. Concepts a newcomer must hold

**Provision.** A distinct clause or section of the agreement covering one
legal concept, for example "the termination fee provision" or "the
representation about material contracts". A provision is a location in the
document with a legal subject, not a value.

**Claim.** One atomic, typed fact recorded about a provision (or, in the
older pipeline, about a card): an attribute and a state, not just a value.
Canonical V2 claim states are `PRESENT`, `ABSENT`, `NOT_APPLICABLE`,
`NOT_EXAMINED` or `FAILED` (`lib/canonical-v2/claims-relationships.js`'s
`CLAIM_STATES`; section 5.3 traces the full identity), and the distinction
is legally load-bearing, not cosmetic: "this agreement has no MFN clause"
(`ABSENT`) is a different, and more useful, statement than "nobody has
checked for an MFN clause" (`NOT_EXAMINED`), and the system will not let a
claim assert `ABSENT` without also recording the scope that was actually
checked (an `ABSENT` claim with an incomplete recorded scope is flagged as a
residual, reason `ABSENT_WITHOUT_COMPLETE_SCOPE`,
`claims-relationships.js:318`, never silently accepted). DECISIONS.md item 5
is a concrete illustration of how granular a claim can get: a payment
deadline that varies by which termination ground fired became one claim per
ground, specifically so "which deals require payment simultaneously with
termination" is a question the stored data can actually answer, rather than
staying buried in an unstructured sentence.

**Occurrence identity, and how it differs from a revision.** An
**occurrence** is the address of a fact: which provision, which governed
concept, which ordinal (for when there can be more than one of something,
such as multiple termination triggers). Its ID is computed only from that
address, deliberately excluding the fact's own answer, so the same
occurrence survives a re-extraction that changes the answer. Concretely, for
a claim: `claim_occurrence_id = contentId('CLAIM_OCCURRENCE/V1',
{subject_occurrence_id, claim_definition_key, claim_definition_version,
ordinal})` (`lib/canonical-v2/claims-relationships.js:304-308`); note what
is deliberately absent from that list: no `state`, no `raw_value`, no
`canonical_value`. A **revision** is the actual answer recorded at that
address on a given run, its own ID computed from the occurrence plus the
value, evidence and state (`claims-relationships.js:321-343`, quoted in full
in section 5.3). This is the direct fix for the older pipeline's central
weakness (`docs/ARCHITECTURE.md` section 2, legacy pipeline: a V1
provision's row ID is regenerated on every re-ingest, which is why
corrections have to be re-attached afterwards by fuzzy text matching): a
Canonical V2 occurrence ID does not depend on a database sequence or on the
specific run that produced it, so it is stable across re-extraction by
construction, and only the revision changes when the extracted answer does.

**Write set.** The single object a canonical write actually commits: every
excerpt, provision, component, claim, relationship and open-world object
produced by one extraction run, keyed and ordered
(`lib/canonical-v2/canonical-writer.js`'s `WRITE_ORDER`, quoted in section
4.7), validated as one unit before anything in it is accepted. See section
4.7 for the mechanics and section 5.6 for how it maps to its governing
specification.

**Open world.** What happens to a candidate whose generic key does not map
onto anything in the current contract vocabulary. The alternative designs
would be to force it onto the nearest registered concept (a closed-world
assumption: if the vocabulary does not name it, treat it as not present) or
to drop it silently. This system does neither: it keeps the candidate, with
its evidence and quote, in a separate, explicitly unresolved bucket
(`open_world_candidates` and its sibling collections in the write set,
section 4.7), so that a fact the model genuinely found, but the vocabulary
has no name for yet, is preserved for a human or a future vocabulary
extension to dispose of properly, rather than being mis-filed under the
nearest plausible existing label or lost. The distinction matters legally: a
wrongly-labelled fact looks authoritative and is not; an open-world fact
looks exactly like what it is, found but not yet classified.

**Review queue.** (See section 2's naming warning; this definition is
specifically Canonical V2's resolution-stage meaning.) The set of
candidates that resolved to a real, registered concept the vocabulary
already understands, but that a deterministic check could not yet certify
clean enough to auto-publish: an ambiguous party, more than one candidate
span, a citation the document's own cross-references could not corroborate,
or a match against a table of previously-confirmed defect patterns. These
are ranked by `MATERIALITY_TABLE` (termination rights and fees rank above
boilerplate, section 4.5) so a reviewer's limited attention goes to the
highest-stakes items first. Being in the review queue is not a failure
state; it is the system correctly declining to guess.

**Serving.** Whether a specific piece of data is the thing an actual user
is actually shown, as opposed to being computed, stored, tested, or shown
only in a gated preview. This is a spectrum this codebase names precisely
rather than treating as binary: PURE_PROPOSAL and preview code is never
served; a dark bridge is `VALIDATED_NOT_SERVED`, correct data flattened for
comparison but structurally incapable of reaching a real route; a serving
source is the one mechanism that can make Canonical V2 data genuinely
served, and as of this writing does so for exactly one family. When in
doubt about whether something is "live", the generated inventory's
`imported_by` / `referenced_by` data plus the family's product-surface
disposition in `docs/codex-program/m3-family-parity-register.json` (see
that file and `lib/canonical-v2/native-producer/m3-family-parity-
register.js`'s `liveProductVisibility()`, which re-derives reachability by
tracing real imports rather than trusting a stored label) are the two
places that answer it by re-derivation rather than by claim.

---

## 7. Why the design is the way it is

**Why per-family rollout, gated by an equivalence check against real data,
rather than a big-bang cutover.** Covered in section 3. The short version:
V1 stays on the page as the thing V2 is graded against, for exactly as long
as grading is possible: once V1 is removed for a family there is nothing
left to compare against except the grading that already happened, so the
grading has to be against the real corpus, not a hand-written fixture.

**Why identity is content-derived rather than sequence-generated.** A
content-derived ID (a hash of what a fact is about, not an autoincrement
counter) is reproducible: two independent runs over the same document
produce the same occurrence ID for the same fact, so corrections,
annotations and cross-references do not need to be re-matched by fuzzy text
search after every re-extraction the way V1's do. The cost is that
constructing an ID requires care (native-write-set-adapter.js's whole
reason for existing is that shifting a byte offset without recomputing
every identity built on top of it would leave a row's stated identity
pointing at text that no longer matches it); the benefit is that stability
is a property of the design, not a thing every downstream tool has to work
around.

**Why open world exists instead of forcing a nearest-match.** Explained in
section 6. The general principle: a system that can say "I found something
but do not yet have a name for it" is safer than one that must classify
everything into an existing bucket, because the second kind of system is
indistinguishable, from the outside, between "correctly classified" and
"force-fitted", and a lawyer reading the output cannot tell which one they
are looking at.

**Why dark bridges are permanent-but-inert rather than temporary
scaffolding that gets deleted once it has served its purpose.** They are
not permanent: OPERATING-RULES.md's ADR-001 gives an explicit, testable
removal condition (every product surface for that bridge's area reaching a
served consumer directly, under the strict locator rule) and instructs that
the bridge be deleted, not just left disabled, once that condition is met.
What is permanent is the rule that a dark bridge's flattened output must
never be written to a production table under any circumstance, because the
flattening step is exactly where information is legitimately lost (a
normalised claim becoming a denormalised card), and the moment that lossy
shape is persisted rather than displayed, the loss becomes someone's
data, not just someone's screen.

**Why the metric-scoped serving-admission chain, a more rigorous
alternative to the serving-source pattern, was built and then not used.**
See `docs/core/GRAVEYARD.md`; the short version is that it was
designed to certify one family (no-shop) with more machinery than the
simpler serving-source pattern needs, and DECISIONS.md item 13 chose the
simpler pattern for the other twenty families once both existed, on cost
grounds, without retiring the more rigorous one.

**Why the specification (section 5) describes so much more than is built.**
`docs/codex-program/canonical-contracts.md` is written, and headed, as
binding target architecture, not a state report; nothing in this guide
should be read as criticising it for describing a fuller system than exists
today. The load-bearing point for a reader making a change is narrower:
before assuming an object the specification names is available to build
against, check section 5's gap list or grep for it directly, because the
specification alone cannot tell you which of its objects are real.

---

## 8. Load-bearing invariants versus convenience

A short list of things that would be a legal-correctness incident if
silently removed, as distinct from things that are merely how the code
happens to be organised today:

- **A claim can never assert `PRESENT` without evidence, or `ABSENT`
  without a recorded complete scope** (section 6; the exact residual reasons
  are `PRESENT_WITHOUT_EVIDENCE` and `ABSENT_WITHOUT_COMPLETE_SCOPE`,
  `lib/canonical-v2/claims-relationships.js:317-318`). Removing this check
  would let the system assert a fact with nothing behind it, or declare a
  clause absent without saying what was actually checked.
- **`claims.canonical`/`canonical_value` is never fabricated to satisfy a
  not-null constraint**, in either pipeline; null means unresolved, not
  zero or false. `docs/ARCHITECTURE.md` section 5 covers the V1 half of
  this (legacy pipeline); section 6 above covers Canonical V2's typed-state
  version of the same rule.
- **Quote verification and the negation-boundary guard**
  (`lib/verification.js`'s `quoteAppearsIn`/`sanitizeFeatureQuotes`,
  `lib/negation-boundary-guard.js`) run unconditionally on every stored
  quote, in production, with no environment gate. This is the check that
  stops "the company represents that the transaction **would not** have a
  Material Adverse Effect" from being trimmed into something that reads as
  the opposite of what the agreement says. It is listed among the
  classified production sources in `lib/canonical-v2/
  phase1-authority-boundary-inventory.js` precisely because it is live
  product behaviour, not proposal machinery. **Check it.** `node --test
  tests/verification.test.js`.
- **Flattened (dark-bridge) data may never be persisted**, covered in
  section 7.
- **A dark bridge, a preview surface, and Canonical V2's API and query-UI
  routes are each gated by their own, independently-implemented
  environment check** (`lib/canonical-v2/feature-flags.js`'s
  `isPermittedCanonicalV2Runtime`, `lib/canonical-v2/dark-bridge-gate.js`,
  `lib/design/route-guard.js`), all of which fail closed (deny) on a
  missing, malformed or ambiguous signal. This is deliberately
  independent, repeated machinery rather than one shared switch, so that a
  bug in one gate does not open every gated surface at once. As of commit
  `2396bf50`, a fourth, broader mechanism, `middleware.js`, additionally
  requires a valid session cookie for essentially the whole application; see
  `docs/core/GRAVEYARD.md` section 0 for exactly what it covers.

By contrast, which specific directory a module lives in, whether a helper
is a `.js` or `.mjs` file, and most of the naming conventions in section 2,
are convenience and history, not protection; do not read architectural
significance into them beyond what this guide states explicitly.

---

## 9. What is actually true today, measured, not assumed

- **Families with a registered producer prompt and resolver support:** 25.
  Measured by `lib/canonical-v2/native-producer/producer-prompt-registry.js`'s
  own `listRegisteredSectionFamilies()`; see the generated inventory's
  `section_families` block for the full, current list.
- **Families genuinely served to a real user in production, end to end, as
  of this writing:** one, termination fees, traced concretely in section
  4.9. Every other family's Canonical V2 path stops at a dark bridge (local
  preview only), a projection with no serving source, or earlier. Re-check
  with the generated inventory's `serving_sources.per_family_modules` list
  and `docs/codex-program/m3-family-parity-register.json`.
- **Whether `supabase/canonical-v2-foundation.sql` has ever run against a
  real database:** **superseded — evidence now exists, and it is not in
  this repository's usual places.** This entry previously read "no evidence
  found, staging or production", which was true of the sources it checked
  and false of the programme as a whole.
  `docs/parked/process-intelligence/EXECUTION-LEDGER.md`'s P8 rows record multiple real
  runs against isolated Supabase staging: `PM-METSERA-PERSISTENCE-01` used
  "the existing `canonical_v2_write` entry point" and wrote a real candidate
  record inside a rollback transaction (exact replay a no-op, conflicting
  replay failed closed, RLS confirmed active, durable rows zero, active
  pointer unchanged); `PM-P8-AGREEMENT-WRITER-STAGING-03` proved the generic
  writer against isolated staging, PASS. Both are marked COMPLETE.
  What is still genuinely unproven is a **durable, non-rolled-back** write —
  every proof above ends in rollback by design. State it that precisely.
  Note `PLAN.md`'s own re-measure command for this
  (`grep -L "new Pool\|\.query(" tests/canonical-v2-writer-*-identity-sql.test.js`)
  only shows that those tests pattern-match source text; it cannot show the
  schema was never executed anywhere, and should not be cited as if it does.
- **Whether Canonical V2 extraction output reaches any user:** no, and the
  block is structural rather than incidental. See section 12.
- **Adversarial test catalogue implementation:** of 289 mandatory tests
  named in `docs/codex-program/adversarial-tests.md`, 7 are genuinely
  implemented against real backing files today; the rest fall through to a
  shared handler that unconditionally throws. `docs/core/GRAVEYARD.md` has
  the exact count and how to reproduce it.
- **How much of the governing specification (section 5) is actually built:**
  sections 0, 1, 2 and 5 closely; sections 3, 4, 6, 7 and 8 each have a real,
  working core substantially narrower than what is specified, with named
  gaps in each of section 5's own subsections above, verified by direct
  `grep` against `lib/`, `scripts/`, `pages/` and `components/` for every
  object name checked.

None of these numbers are pinned in this guide as if they were permanent;
each is stated with the file or command that re-measures it, per this
document's own opening warning about documents that go stale silently.

---

## 10. Where to go next

- **What exists, exhaustively:** not committed; run `npm run
  generate:codebase-inventory` to derive it fresh (writes to
  `docs/codex-program/generated/system-inventory.json`, uncommitted).
- **What was built and is deliberately or accidentally unused:**
  `docs/core/GRAVEYARD.md`.
- **The older pipeline, in full file-and-line detail:**
  `docs/ARCHITECTURE.md` (legacy pipeline only, stale since 15 July; see
  section 0).
- **The Canonical V2 specification itself, and how to read only the part
  you need:** `docs/codex-program/canonical-contracts.md`, section 5's
  closing note above.
- **Rulings that shaped the design, in Ben's own words:**
  `docs/core/DECISIONS.md`.
- **Why documentation in this repository should be checked rather than
  trusted, and what already checks itself:** `docs/codex-program/notes/
  doc-reality-audit.md`.
- **The dark-bridge architectural decision in full:**
  `docs/core/OPERATING-RULES.md`, "ADR-001: dark-bridge flattening
  is scaffolding, not a serving path".

---

## 11. Commands, and what each one proves

Every command here was run before being written down. The point of this
section is that a coding agent should never have to guess how to verify its
own work, and a human reader should be able to tell what a passing command
actually establishes, which is often narrower than it sounds.

### Running the whole suite

```
CI=true npm test > /tmp/suite.log 2>&1; echo "EXIT=$?"
```

Roughly 7,700 tests, about two minutes. `CI=true` matters: at least one
subsystem behaves differently under continuous integration, and four test
suites once passed locally while failing in CI for that reason.

**Never pipe this into `tail` or `head`.** A shell pipeline reports the exit
code of its LAST command, so `npm test | tail` reports whether `tail`
succeeded, which it always does. That mistake has produced a false "the suite
passes" report in this project more than once. Redirect to a file, echo `$?`
immediately, then search the file.

What a green suite proves: no committed behaviour regressed. What it does not
prove: that any of it renders, or that a live model produces the shapes the
tests replay.

### Running one file

```
node --test tests/canonical-v2-termination-fee-resolution.test.js
```

### Extraction, against a real filing

```
node scripts/canonical-v2-live-extraction-run.mjs --dry-run \
  --deal modiv --family TERMINATION_FEE --section-refs '7.1,7.3,8.12'
```

Resolves the deal's pinned source, verifies both its hashes, sectionizes,
resolves every named section and reports how many model calls a real run
would make. It stops before calling a model, so it costs nothing. Use it to
check a family-to-section mapping before paying for anything.

The same command without `--dry-run`, plus `--out-dir <path>`, performs the
live run. It costs real money: the 25-family sweep was 58 model calls and
$20.30. Add `--call-timeout-ms` above the 600,000 default for a slow section;
capitalisation needed it.

### Verifying quotes, gates and drift

```
bash scripts/lint/forbidden-patterns.sh          # fingerprints of past regressions
node scripts/verify-codex-program-spec.mjs       # the two pinned data files
node scripts/review-parity-check.js \
  --mapping lib/review-parity/mappings/termination-fees.json \
  --cases tests/fixtures/review-parity/cases/termination-fees
```

The parity check compares the V2 view of a family against the legacy view,
deal by deal, reading files only. Its exit codes are deliberate: 0 clean, 1 a
real difference, 2 nothing could be compared. **Exit 2 is the one to watch.**
A run that proves nothing must not look like a run that proves everything,
and on termination fees it currently returns 2, because no committed artefact
holds the legacy side.

### The functions worth knowing by name

An agent changing behaviour will almost always be in one of these.

| Function | File | What it decides |
|---|---|---|
| `sectionizeAdmittedSource()` | `lib/canonical-v2/native-producer/deterministic-sectionizer.js` | Where every section starts and ends |
| `findSectionByReference()` | same | Turns "7.1(c)(i)" into a node. Plain first match, no ambiguity detection, returns null when it cannot |
| `runNativeExtraction()` | `lib/canonical-v2/native-producer/native-extraction-run.js` | Dispatches one model call per section |
| `getProducerPromptModule()` | `lib/canonical-v2/native-producer/producer-prompt-registry.js` | Picks the prompt for a family. 25 registered |
| `resolveCandidates()` | `lib/canonical-v2/native-producer/candidate-resolution.js` | Turns model output into resolved claims, review-queue entries or open world |
| `buildNativeWriteSet()` | `lib/canonical-v2/native-producer/native-write-set-adapter.js` | Assembles the validated write set |
| `validateResolvedCanonicalWriteSet()` | `lib/canonical-v2/validate-write-set.js` | Last gate before anything is publishable |
| `liveProductVisibility()` | `lib/canonical-v2/native-producer/m3-family-parity-register.js` | Whether a surface can be proven to reach a user |

### Where knowledge lives, when a step says "widen the vocabulary"

| What | File |
|---|---|
| Provision taxonomy and bucket synonyms | `lib/taxonomy.js` |
| Legacy provision types and field shapes | `lib/rubric.js` |
| Per-family extraction instructions | `lib/canonical-v2/native-producer/*-producer-prompt.js` |
| Which prompt serves which family | `lib/canonical-v2/native-producer/producer-prompt-registry.js` |
| Corroboration patterns, fee side and trigger | `lib/canonical-v2/native-producer/candidate-resolution.js` |
| Claim definitions and contract versions | `lib/canonical-v2/contract-bundle.js` |
| Which sections of which deal carry which family | `scripts/canonical-v2-live-extraction-run.mjs`, `DEAL_PINS` |
| Gate definitions | `docs/codex-program/programme-gates.yaml` |

Only one family's section mapping is currently in code. The other twenty-four
exist inside committed artefacts under `evidence/` — twenty in
`evidence/canonical-v2/modiv-antitrust-20260806/run-manifest.json`'s
   `section_references`, four in
`evidence/canonical-v2/modiv-capitalisation-20260806/section-location-scan.json`'s
   `requested_section_references` — and at least
two of those are wrong (CONSIDERATION and KEY_DEFINED_TERMS; see `PLAN.md`
Step 2A). They are recoverable, not lost.

---

## 12. Where Canonical V2 output goes, and where it stops

Established 2026-08-06 by four independent code traces, each verifying
against the tree rather than against a document. This section exists because
the answer is counter-intuitive and has been mis-stated in both directions:
the pieces all exist, and they are not connected to each other.

### 12.1 The short version

An extraction run writes JSON to disk and stops there. **Nothing functional
reads it back.** Grep the tree for `resolution.json`, `run-receipt.json`,
`adapter-result.json`, `review-queue.json`, `validation.json`: the only
non-comment consumer is `scripts/nets-eligibility-report.mjs`, and that
script has been broken since commit `0d17ad00` (2026-08-04).

So a successful campaign of 25 families across 15 documents, every gate
green, changes nothing any user can see. That is not a bug in the runner. It
is a missing stage, and it is worth naming as one rather than rediscovering
it per-family.

**Updated 2026-08-07 (`0993715`): the write half of that stage now exists.**
`lib/canonical-v2/evidence-to-write-set-bridge.js` carries a run directory
into `canonical-writer.js`, and `evidence/canonical-v2/modiv-antitrust-20260807-replay`
imports end to end — 10 excerpts, 13 provisions, 13 claims — with its
admitted-source lineage rebuilt from the committed raw HTML by
`lib/canonical-v2/admitted-source-chain-rebuild.js` and verified by the
writer rather than asserted by the caller.

Three things about that which will otherwise be rediscovered the hard way:

1. **The write-set inside `adapter-result.json` is not the one the run
   validated.** It carries no `provisions`; the runner adds them from
   `resolution.json` at `canonical-v2-live-extraction-run.mjs:1114`. A claim
   with no governing provision is *dropped*, not rejected, so importing the
   adapter's write-set directly publishes the excerpts, loses every claim,
   and reports `accepted: true`.
2. **Runs made before 2026-08-07 cannot be imported here**, because
   `IMMUTABLE_SOURCE_DOCUMENT/V2` embeds a DEFLATE-output digest and DEFLATE
   output is not stable across zlib builds. See PLAN.md Step 2B, Defect 2.
   Regenerate by replay (zero model calls); do not re-derive the reference.
3. **The read half is still missing.** Nothing serves this out of the
   database yet — see 12.2 below, which remains true of the read direction.

### 12.2 The four things that are separately true

1. **The general runner works and is disconnected.**
   `scripts/canonical-v2-live-extraction-run.mjs` dispatches all 25
   registered families through a real registry seam (334-340). Its output is
   `evidence/canonical-v2/<deal>-<family>-<date>/`. Terminal.
2. **A real Postgres client exists.** `lib/canonical-v2/serving-client.js`
   is a genuine `pg` `Pool` client (line 2, `createPostgresServingClient` at
   198) against a staging Supabase project, with import scripts under
   `scripts/canonical-v2-staging-*.mjs` and SQL under `sql/optionA/`. So
   `PLAN.md`'s former "There is no persistent repository" claim, on the write
   orchestrator row, was **false at the tree level** — corrected there since,
   and cited here by content rather than line number because the line moved. It is a separate, hand-built, per-deal pipeline (QXO), fed
   by manual fixtures and SQL runbooks, gated to a staging env flag — so the
   claim is *effectively* true for the general 25-family runner while being
   *literally* false about the codebase. Both halves matter.
3. **Production is hard-off by construction.** `pages/review/[id].js` embeds
   `<CanonicalReviewSection>`, but `isPermittedCanonicalV2Runtime` in
   `lib/canonical-v2/feature-flags.js` returns true only for
   `VERCEL_ENV === 'preview'`, or when no Vercel runtime is detected and
   `NODE_ENV !== 'production'`. Every other case is denied, deliberately —
   the function's own comment says "so production stays hard-off".
4. **The review UI users see is V1.** `lib/queries/review-deal.js` reads
   `claims`, `provision_cards`, `provisions`, `deals`. Canonical V2 output
   would not land in those tables even if it were persisted.

### 12.3 Ingest: one live path, and what it skips

`scripts/ingest-local.js` is the only working way to add a deal, and
self-documents as such. Two consequences that are easy to miss:

- It has **zero references** to `lib/edgar-catalog.js`, so it never calls
  `selectAgreementExhibit` and therefore never runs the
  amendment/restatement classifier. The classifier
  (`lib/agreement-revision-classifier.js`) is real and good — it returns
  `AMBIGUOUS` for a human rather than guessing — but the live ingest path
  goes around it. You must already know your URL is the original agreement.
- Its `needs_human_review` signal reaches no human. The only UI consumer,
  `pages/api/admin/candidates.js`, is
  `createBroadCorpusContainedHandler(['GET', 'PATCH'])` — a 503.

`pages/admin/agreements.js` is the "add a deal" UI and cannot save in any of
its three modes: `/api/deals` and `/api/provisions` both import
`sendBroadCorpusRouteContained`. Of 23 routes contained via
`createBroadCorpusContainedHandler`, 18 have no stated reason in any of the
six core documents. `/api/ingest/from-url` is one of the 5 that does —
`PLAN.md:1053`, unauthenticated SSRF, a good reason.

A freshly ingested deal renders an **empty** `/review` page until a human
runs card-materialisation scripts by hand (`scripts/backfill/extract-to-cards.js`,
`scripts/backfill/claims-from-normalized.js`). This is a V1 gap, is
self-documented as a "KNOWN PIPELINE GAP", and is unrelated to Canonical V2 —
do not file it as a V2 problem.

### 12.4 Measured cost of a family run

From the 20 of 24 `evidence/canonical-v2/modiv-*-20260806/` directories whose
`run-manifest.json` carries `extraction_wall_clock_ms` (four have no manifest;
the glob matches 24 directories, not 25):

| Measure | Value |
|---|---|
| Mean wall-clock per family-run | ~255,200 ms (~4.25 min) |
| Median | ~204,500 ms |
| Max | ~1,100,100 ms (and that run still timed out) |
| Model calls | `projected_model_call_count` = `config.sectionRefs.length`; ~2 actual mean |
| Parallelism | none — fully serial, no `Promise.all` (`native-extraction-run.js:635`) |

A 1→4→12→25 ladder is 42 family-runs per document: about **3 hours per
document serially, ~25 minutes at eight-way parallelism**. A 15-document
campaign is roughly 45 hours serial, or about 6 hours at eight-way. An earlier
version of this section quoted the campaign figure as if it were per-document.

**Re-measure** rather than trusting these:
`node -e "const fs=require('fs');const d=fs.readdirSync('evidence/canonical-v2').filter(x=>/^modiv-.*20260806/.test(x));..."`
reading `extraction_wall_clock_ms` and `model_call_count` from each
`run-manifest.json`.

### 12.5 State of the committed Modiv baseline

24 run directories. **Not all completed.** Two have no `run-receipt.json`
(`capitalisation`, `closing-conditions`); four have no `run-manifest.json`
(those two plus `interim-operating`, `no-other-reps`). Eleven of the twenty
complete runs resolved zero.

Zero can be correct — guaranty on an unfinanced deal is the standing example
— but not all of these are. `REPRESENTATIONS`, `PROXY_MEETING` and
`KEY_DEFINED_TERMS` show candidates present with zero resolved, which points
at a resolver-stage gap rather than genuine absence. `MAE_DEFINITION` has
never been run against Modiv at all; the only 2026-08-06 MAE run is
`topbuild-mae-definition-20260806`.

Consequence for any plan gated on "incomplete is 0": **that gate does not
pass today**, before any new work begins.

**Updated 2026-08-07.** All of the above still describes the 2026-08-06
directories, which are kept as the record of what was actually run. Beside
them there is now a regenerated baseline — `*-20260807-replay` — produced by
replaying those runs' own committed responses through the current code with
**zero model calls**. Read `evidence/canonical-v2/baseline-manifest.json` for
the current numbers rather than the paragraphs above; regenerate it with
`npm run generate:baseline` and check it with `npm run gate:baseline`.

What changed, and what did not:

- **The three incomplete runs completed.** `capitalisation`,
  `closing-conditions` and `interim-operating` kept their recorded responses,
  and replaying those responses through the current code finished two of them
  outright. `closing-conditions` is the exception and it is a finding, not a
  crash: its section 6.2 recorded response is not a model response at all but
  a captured CLI status message, so only 6.1 could be replayed and the
  directory is named `-6.1-only-` to say so. 6.2 needs a live call.
- **All 25 registered families now have an importable run** — 24 Modiv, plus
  `MAE_DEFINITION` from `topbuild-mae-definition-20260807-replay`. That family
  has still never run against Modiv.
- **The zero-resolved observation still stands, and it is bigger than this
  section said.** Ten of the 25 importable runs publish **zero claims**:
  `APPRAISAL_DISSENTERS_RIGHTS`, `DIVIDENDS`, `EMPLOYEE_MATTERS`,
  `FINANCING_COVENANTS`, `GENERAL_COVENANTS`, `GUARANTY_FINANCING_PARTY`,
  `KEY_DEFINED_TERMS`, `REPRESENTATIONS`, `SPECIFIC_PERFORMANCE_REMEDIES`,
  `TAX_MATTERS`. Regeneration moved four families up (V38 gives candidates a
  governed home V34 did not) and moved none down, so this is not a
  regeneration artefact.

  Guaranty on an unfinanced deal is the standing example of a correct zero.
  Ten is not ten instances of that. `REPRESENTATIONS` and `KEY_DEFINED_TERMS`
  in particular show candidates present with zero resolved, which is a
  resolver-stage question rather than a documented absence — and until it is
  answered, **"25 families have an importable run" and "25 families produce
  data" are different statements.** Fifteen produce claims.
- **Only the 2026-08-07 runs can be imported.** The originals cannot: they
  record neither their retrieval timestamp nor their compressed source map,
  so their identity cannot be rebuilt. See PLAN.md Step 2B, Defect 2.

### 12.6 Section-reference lists are not lost

`DEAL_PINS` in `scripts/canonical-v2-live-extraction-run.mjs` (226) pins
exactly one family for Modiv (`TERMINATION_FEE`) and none for TopBuild. But
the other lists exist: 20 run directories carry `section_references` in
`evidence/canonical-v2/modiv-antitrust-20260806/run-manifest.json` and its
siblings, and the four without a manifest carry
`requested_section_references` in
`evidence/canonical-v2/modiv-capitalisation-20260806/section-location-scan.json`
and theirs (verified:
capitalisation → `["3.2","4.2"]`). All 24 are mechanically recoverable.
Do not re-derive by hand what is already committed.

### 12.9 Replaying a historical run

`scripts/canonical-v2-live-extraction-run.mjs --replay-from-run <dir>` re-runs
a family against the per-section responses a previous run already recorded,
with **zero model calls**. Every historical run wrote those fixtures
(`native-producer-recorded-response-<ref>.json`), so any of them can be
re-scored through today's resolver.

This is what fixed the one committed run that failed validation.
`modiv-no-other-reps-20260806` was missing `attributes.answer_provenance` on a
claim — a real defect from a crash, since fixed in the resolver.
`modiv-no-other-reps-20260807-replay` is the same run's responses through the
fixed code, and it passes. The broken run is kept: it is the evidence the
defect existed.

**The keying is weaker than `--replay`, deliberately.** Those fixtures carry
`section_reference` and `raw_response_text` but no request messages, so
replay is served in the order the caller asks rather than matched to each
request. Sound for one call per pinned section, in order; not sound for a
citation-following run. Use `--record` for anything you intend to re-run
repeatedly.

### 12.8 Call attribution in run telemetry is order-based, and bounded

`makeMeasuredCliClient` in `scripts/canonical-v2-live-extraction-run.mjs`
attributes each model call to a section by **call order** against the pinned
section list. That is sound only while a run issues exactly one call per
pinned section.

`--follow-citations` breaks that assumption by design: it dispatches extra
calls beyond the list. Before 2026-08-07 those were labelled
`unknown-call-N`, and the committed
`modiv-termination-fee-citation-following-20260806` run has **11 of its 14
calls** labelled that way. They were never unknown — they are citation
follow-ups.

They are now labelled `citation-followup-N`, and every telemetry row carries
`attribution_basis`: `ORDERED_PINNED_SECTION` or
`CITATION_FOLLOWUP_UNATTRIBUTED`. The section reference is not recoverable
from the prompt at that seam (checked), so a consumer needing per-call
section identity for follow-up calls must get it from the citation-following
module rather than from telemetry.

Older telemetry files keep the `unknown-call-N` labels and have no
`attribution_basis` field. Do not read their absence as
`ORDERED_PINNED_SECTION`.

### 12.7 Re-deriving this section

Nothing above should be trusted because it is written here. Each claim names
its file and line so it can be re-checked, and the cheap re-checks are:

```
grep -rn "resolution\.json\|run-receipt\.json" --include=*.js --include=*.mjs lib/ pages/ scripts/
grep -n "isPermittedCanonicalV2Runtime" -A 8 lib/canonical-v2/feature-flags.js
grep -rln "createBroadCorpusContainedHandler" pages/api/ | wc -l
grep -n "edgar-catalog" scripts/ingest-local.js    # expect no output
```
