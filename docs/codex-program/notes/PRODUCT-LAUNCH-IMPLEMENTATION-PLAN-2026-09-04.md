# Product launch implementation plan

Date: 2026-09-04

Status: final after two independent Sol reviews.

This plan starts from the product outcome. It uses prior work only where that
work helps deliver the outcome. A historical rule does not survive merely
because it exists.

## 1. Product outcome

A lawyer supplies an SEC merger-agreement URL. The product returns a complete,
usable summary of the agreement's key provisions.

Each material statement must:

- state one legal fact;
- identify the relevant party, action, trigger, condition, exception,
  threshold and timing rule;
- link to the exact source words that support it;
- show enough surrounding text to understand those words; and
- have an explicit review state.

For the first internal release, AI prepares the draft and a lawyer confirms the
final result. Only lawyer-accepted facts are final.

The release is complete when Ben can submit a new SEC agreement, watch it
process, review and correct the proposed summary, publish the accepted result,
and reopen it in Review. No developer, fixture or manual script is part of the
ordinary flow.

A published agreement remains editable. A later edit creates a new reviewed
revision and release. The prior published revision remains recoverable.

Compare and Query follow after this release. They do not block the first useful
product.

## 2. Architecture decision

Build one path. Use the existing AI-assisted native producer as the extraction
spine. Use the useful deterministic contract work as validation data. Do not
use word-token rules to infer legal meaning.

There is one structural source of truth: `AgreementStructure`. Its small
contract contains node ID, parent ID, kind, authored order, span and
annotations. Build it once from the shared pure `deterministic-sectionizer`
parser. The Stage 2Y `AgreementIndex` wrapper remains historical compatibility
code because it requires policy and digest bindings. Do not carry those or any
experiment bindings into the active path. The native producer must consume the
stable `AgreementStructure` nodes and must not sectionise the source a second
time.

The orchestration interfaces are:

```text
startAgreementAnalysis({ secUrl, legalSchemaVersion }) -> analysisRunId
getAgreementAnalysis(analysisRunId) -> runStatus | draftAnalysis
publishReviewedAgreement({ analysisRunId, reviewRevision }) -> releaseId
```

The internal extraction interface is:

```text
buildAgreementDraft({ sourceDocument, agreementStructure, legalSchema, model })
  -> draftAnalysis
```

This name avoids collision with the existing shadow `analyseAgreement`
function. Replace or retire that function explicitly. Do not leave two
concepts with the same name.

### Where AI is used

| Step | AI? | Reason |
|---|---|---|
| Fetch SEC filing and preserve raw response | No | Retrieval and hashing are exact operations. |
| Identify accession, exhibit and original, amended or restated status | No, unless ambiguous | Existing rules should settle clear cases. An ambiguous document goes to review. |
| Convert SEC HTML to canonical text and source map | No | The same bytes must produce the same text and locations. |
| Build the authored section and limb tree | No | Structure and authored order must be reproducible. |
| Resolve definitions, chapeaux and cross-references | No | Deterministic links keep context stable. |
| Generate candidate family labels from headings and rules | No | Cheap signals help the semantic router but do not decide coverage. |
| Route every substantive section to one or more families | Yes | Even a clear heading can hide a secondary subject. Deterministic labels are inputs, not a short circuit. |
| Propose atomic facts, groups, relationships and spans | Yes | Legal effect and unusual drafting exceed fixed token rules. |
| Find unusual material provisions outside the catalogue | Yes | A closed family list cannot prove open-ended coverage. |
| Confirm exact quotes and byte spans | No | This must be exact. |
| Parse money, dates, percentages and references | No, after AI locates them | Code should normalise identified values. |
| Check required roles and relationship shape | No | The legal schema defines completeness. |
| Confirm legal meaning | Lawyer at launch | Exact words prove provenance, not interpretation. |
| Persist, publish and render accepted facts | No | Product state must be stable and repeatable. |

The rule is simple: AI proposes meaning. Code proves source identity, exact
text, data shape and completeness against the schema. A lawyer confirms legal
meaning until held-out results justify narrower automatic acceptance.

### Source closure

The model and the lawyer receive a source closure, not one isolated quote. A
source closure contains:

1. the complete operative sentence or list limb;
2. its governing chapeau;
3. relevant defined terms;
4. cited cross-references;
5. the full section on demand; and
6. a mapping to the original SEC filing.

Deterministic code assembles this context. AI interprets it. Clicking a field
focuses the exact supporting words inside the context. A fact can cite several
spans.

## 3. Product data model

Keep these records separate. Combining them created the current false idea
that `resolved` means trusted.

- `SourceDocument`: immutable SEC response, document identity, canonical text,
  source map and hashes.
- `AnalysisRun`: one processing generation with status `QUEUED`, `RUNNING`,
  `PARTIAL`, `FAILED` or `READY`.
- `ModelCall`: stored request, response, model, prompt version, cost and timing.
- `Span`: exact source location plus its source-closure links.
- `Proposal`: immutable AI suggestion with `PROPOSED`, `REJECTED` or
  `SUPERSEDED` state.
- `Issue`: an extraction, validation or coverage problem. An issue is not a
  fact.
- `CoverageAssertion`: one family, role or substantive section with `FOUND`,
  `NOT_FOUND`, `UNRESOLVED` or `NOT_RUN` state.
- `FactRevision`: lawyer-authored or lawyer-accepted legal fact tied to
  proposal, span and schema versions.
- `PropositionGroup`: related facts that form one legal effect.
- `FactLink`: typed relationship such as `QUALIFIES`, `EXCEPTS`, `TRIGGERS`,
  `DEFINED_BY` or `ALTERNATIVE_TO`.
- `ReviewRevision`: autosaved reviewer decisions with optimistic locking.
- `AgreementRelease`: an atomic pointer to one complete reviewed revision,
  with prior releases retained.

An agreement has one product state: `DRAFT`, `PARTIALLY_REVIEWED`,
`REVIEW_COMPLETE` or `PUBLISHED`. Partial output must show its unresolved count
and must not call itself complete.

A client idempotency key deduplicates retries of one submission. An analysis
generation is identified by source hash, legal-schema version, prompt-bundle
version and model configuration. An intentional rerun creates a new generation.
A fact occurrence keeps one stable identity across generations. A new proposal
or human edit creates a revision. It does not overwrite accepted work or create
a duplicate occurrence.

`SOURCE_SCOPE_CERTIFICATION_ABSENT` is not a universal positive-fact blocker.
A positive fact can be accepted when its legal meaning and evidence are
confirmed. Document and family coverage control absence statements. `NOT_RUN`
must never appear as `NOT_FOUND` or `NOT_PRESENT`. Only a lawyer-confirmed
coverage assertion may use `NOT_PRESENT` in published copy.

## 4. Legal coverage contract

"All key provisions" needs a denominator. For launch, the existing 25-family
catalogue is the minimum denominator. It is not a closed universe.

Create one versioned legal schema from the existing family taxonomy, B subtype
work, required-role rules and Ben's substantive decisions. For each family and
subtype it states:

- required fact types and semantic roles;
- conditions, exceptions and relationships that must be represented;
- materiality rules;
- permitted compact-summary omissions;
- absence semantics; and
- the grammar of the displayed summary.

Codex derives the first version. Ben sees only genuine legal ambiguities or a
compact omission that could hide a legal distinction. He is not asked to
approve identifiers, storage shapes, prompts, sample sizes or test design.

Every substantive section must be assigned to one or more known families,
marked immaterial, or recorded as an unresolved unusual provision. Routing is
multi-label. AI can add or dispute a family even when a heading rule succeeds.

## 5. Reuse, change and retire

### Reuse after a direct fit test

- SEC network restrictions and source controls from the existing broad-corpus
  and Canonical V2 intake code.
- Raw SEC capture and canonical source mapping from
  `sec-edgar-intake-capture.js` and `sec-html-canonical-text.js`.
- Amendment and restatement classification from
  `agreement-revision-classifier.js`.
- The shared pure `deterministic-sectionizer` parser used behind the historical
  `AgreementIndex` wrapper, exposed through the policy-free
  `AgreementStructure` builder and its source-span helpers.
- The multi-family information in the section classifier.
- The 25 family prompts as starting material, not as proof of completeness.
- Provider record and replay.
- UTF-8 byte-span validation and useful numeric, date and reference parsers.
- B's family, subtype, required-role and relationship knowledge as declarative
  validator input.
- The immutable V2 serving store as the publication substrate, if it fits the
  new publication interface without carrying M-stage machinery.
- Existing authentication, least-privilege database roles and production route
  guards.

### Build or change

- One canonical SEC intake adapter. It returns raw bytes, headers, retrieval
  URL, final URL, accession and exhibit identity. It refuses redirects or hosts
  outside the exact approved SEC policy.
- An asynchronous and resumable job model. A client idempotency key deduplicates
  request retries. Source, schema, prompts, model configuration and generation
  distinguish intentional runs.
- Per-section work items with retry state. One provider failure creates
  `PARTIAL`; it does not discard completed work.
- A native producer that consumes `AgreementStructure` and source closures.
- Multi-label deterministic plus AI routing.
- Atomic proposals, proposition groups and typed relationships.
- Declarative required-role validation.
- Durable model calls and provenance references. Do not duplicate the raw
  request, response or every hash on each fact.
- Draft persistence, autosave and audit history before the editor is built.
- A context compiler and source panel for all supporting spans.
- A section-led review flow with accept, edit, reject, add-missing-fact,
  mark-unresolved and save-progress actions. Revision history handles restore.
- One reviewed-summary presentation. Every sentence and field cites accepted
  facts and spans.
- Atomic publication through one release pointer.

### Retire from the active path

- `m7-v2-deterministic-generator.js` as an extractor.
- The 1,382 token profiles as a locator or interpreter. Preserve useful
  subtype and role rules as validator data.
- The frozen M4 boundary.
- The V1-to-V2 comparator as a trust condition. Keep it as an optional
  migration diagnostic where comparable V1 output exists.
- Synthetic facts on real-document product paths.
- The overlapping `resolved` and `review_queue` model.
- `auto_pass` as an internal publication decision.
- M0-to-M10 work orders, authorities, registrations, receipts, reseals and
  per-family certificates.
- Transitive predecessor hashes and downstream re-verification of unchanged
  historical evidence.
- A second AI corroborator before the basic proposer, validator and lawyer
  workflow is measured. Model agreement is not legal proof.

Keep old evidence in Git. Do not regenerate it in normal development or CI.

## 6. Delivery plan

The target is five calendar weeks. Phase 2 supplies a measured throughput check
on day 9. The manager updates estimates then, but does not reduce the outcome.
Phase 4 contains 6 to 8 parallel person-days, not a promise that every remaining
family finishes in one elapsed week.

### Phase 0. Clear the road and define the denominator, 2 days

- [x] Replace the active plan with this plan.
- [x] Reduce required project reading to the four live documents in section 8.
      `PLAN.md` points to this named dated plan, which is the sole exception
      to the rule that dated notes are evidence only.
- [x] Replace blocking CI with the checks in section 9 before removing old
      gates.
- [x] Remove phase allowlists and stop generating programme receipts,
      registrations and authority files.
- [x] Derive legal schema V1 for Termination, Termination Fee and No-Shop.
- [x] Define the full 25-family schema outline and record only genuine legal
      gaps as issues.
- [x] Define and test the minimal structure contract. Prove that the shared
      pure section parser and source-span helpers can be reused without the
      Stage 2Y `AgreementIndex` policy, digest or experiment bindings. The
      contract preserves true authored order, parser residual diagnostics,
      source-derived node and annotation identity, and safe UTF-8 byte spans.
- [x] Convert the existing 50 items into atomic development regressions. Label
      no-run, wrong meaning, missing role, parser, duplicate and display errors
      separately.
- [x] Select one development agreement, one calibration agreement and one final
      blind agreement absent from the current tree and all Git history. Do not
      inspect the blind result before Phase 5.

Exit: product work can proceed without M-stage paperwork, and the three-family
vertical slice has a legal denominator and development data.

### Phase 1. Build the durable source and job foundation, 3 days

- [x] Add the canonical SEC intake adapter.
- [x] Confirm accession, exhibit, parties, agreement date and revision status.
      Route ambiguity to one short document-identity review.
- [x] Persist the immutable `SourceDocument` before analysis starts.
- [x] Build `AgreementStructure` once as the only active structural source.
- [x] Add `AnalysisRun`, per-section work, retry, resume, cost and progress.
- [x] Deduplicate network retries with a client idempotency key. Let a changed
      schema, prompt bundle, model configuration or explicit generation create
      a new run on the same source.
- [x] Prevent partial analysis from mutating the visible deal.
- [x] Add the draft tables, optimistic locking and audit history.

Exit: a submitted SEC URL becomes a durable, resumable run with one canonical
source and structure. Failure leaves an honest status and completed work.

Plan correction: keep the archive-path CIK and accession prefix as independent
SEC fields. Filing-agent submissions can make them differ. The selected
Amazon/Globalstar filing is a valid example, so equality is not an identity
rule.

### Phase 2. Complete one source-to-review vertical slice, 4 days

Scope: Termination, Termination Fee and No-Shop on the development agreement.

- [x] Implement `buildAgreementDraft` against `AgreementStructure`.
- [x] Run semantic multi-label routing over every substantive section. Supply
      deterministic family labels as evidence, never as a short circuit.
- [x] Give extraction calls complete source closures.
- [x] Persist raw model calls once and link proposals to call and span IDs.
- [x] Produce atomic proposals, proposition groups and fact links.
- [x] Validate exact spans, values, required roles and group consistency.
- [x] Persist issues and four-state coverage.
- [x] Build the source context compiler.
- [x] Expose the draft through a read interface suitable for Review.

Exit: one real agreement reaches a durable, internally coherent draft through
the new interfaces. Every proposal is reproducible from its source and model
call. There is no M4 or receipt dependency.

Plan correction: Phase 2 proves the durable interfaces with the real Concho
SEC source and a deterministic synthetic model double. Actual recorded family
and all-family provider fixtures remain Phase 4 work, where the checklist
expressly assigns them. `PRODUCT_MODEL_RECORDING/V1` is contract-tested in
Phase 2, but it is not presented as actual provider evidence.

### Phase 3. Make the vertical slice usable, 4 days

- [x] Add an authenticated SEC URL submission form.
- [x] Show run progress, partial and failed states, retry controls and cost.
- [x] Navigate automatically from a `READY` run to Review.
- [x] Build the section-led review worklist.
- [x] Show each proposal as plain legal English with its complete material
      fields and relationship group.
- [x] Show the source closure and exact highlights on field click.
- [x] Add accept, edit, reject, add-missing-fact, mark-unresolved and
      save-progress actions. Use revision history to restore mistakes.
- [x] Preserve source links when accepted wording changes.
- [x] Require individual review of proposed facts and every exception,
      including unusual, unresolved and `NOT_FOUND` results and any uncertain
      `IMMATERIAL` classification.
- [x] Show all other section dispositions in one compact coverage view and
      require one agreement-level coverage confirmation before publication.
- [x] Let a lawyer reopen a published agreement, edit it and publish a new
      reviewed revision without losing the prior release.
- [x] Render the accepted Termination, Termination Fee and No-Shop summary in
      Review.
- [x] Measure proposal errors, omissions and total review time on the
      calibration agreement.

Exit: Ben can submit a real SEC URL, observe the run, recover from a failure,
reach Review automatically and publish a reviewed three-family summary without
a developer. Record actual run time, model cost and review time.

Calibration result: the real Modiv SEC source completed the current
source-to-review runner in 119.057 seconds. Its deterministic calibration model
recorded 102 model calls and $0.001560 of call cost. The reviewed result recorded
one proposal error, one omission and a 180-second review interval. The automated
review commands themselves took 2 milliseconds.

Plan correction: Phase 3 uses the same deterministic-model boundary accepted
for Phase 2. The live Anthropic adapter records exact requests, responses,
tokens, duration and cost, but no provider credential is present in the local
test environment. Recorded provider fixtures remain a Phase 4 checklist item.
The Modiv calibration therefore measures the real source, structure, runner,
review and publication contracts without presenting its deterministic model
cost as a live Anthropic charge.

### Phase 4. Scale from three families to all key provisions, 6 to 8 parallel person-days

Run independent family groups in parallel. Each group uses the same
interfaces, state model and review UI.

- [x] Derive each remaining family contract from current prompts, subtype work,
      required-role rules and substantive decisions.
- [x] Audit each existing prompt against that contract. Fill legal-output gaps
      rather than assuming the prompt is complete.
- [x] Convert reusable B rules into validator data.
- [x] Run all relevant families over every substantive section without hand
      pins.
- [x] Account for sections with more than one family.
- [x] Run a paragraph-level residual pass for unusual material provisions.
- [x] Show unresolved unusual provisions in the same review worklist.
- [x] Add recorded family tests and one all-family source-to-review test.
- [x] Correct shared error classes only. Do not add agreement-specific keyword
      patches.

Plan correction: no live provider credential was available in the Phase 4
environment. The repository already contained actual provider outputs for all
25 families. Phase 4 replays those outputs through each registered family
response shaper against its exact recorded source text. Exact identifier
mappings admit compatible facts. Unmapped identifiers and shaper residuals
remain explicit incompatibilities and produce unresolved product issues.

Exit: the calibration agreement has a complete 25-family and residual review
result. Every substantive section and required role has a disposition.

### Phase 5. Freeze, test blind and correct honestly, 3 days

Current position, 2026-09-06: Olaplex completed all 79 sections in about 36
minutes through ordinary private intake. Ben's independent, partial legal notes
have exposed missing duties, lost qualifications and insufficient citations.
Shared corrections are in progress. Cross-section relationship proposals now
pass source-ownership and database checks without another AI pass. Stronger-model
diagnostics capture more detail, but still lose some scope and citation context.
The corrected candidate is not accepted. The private candidate now retains
the smaller model for routing and uses the stronger model for extraction. Explicit
hour periods and non-duration update duties are retained in the data model.
The original Olaplex run is unchanged. Testing it again is diagnostic work,
not a new blind test. Full lawyer review, publication and the combined 90-minute
processing/review bar remain unproved. No release bar or production setting has
changed. Speed work and precedent tracing remain deferred.

The seventh Public Storage diagnostic retains all 105 saved sections, 338
proposed facts and 62 proposed relationships. Its private review page shows
1,291 pending items and no legal decisions made. Source highlighting and
relationship correction passed local browser and database checks, including
rollback. The original Olaplex run had one built-in retry, no code change and
no manual retry. Intake was left before completion to avoid starting the
lawyer's review clock or opening the AI draft before independent notes.

Speed investigation: the sixth diagnostic completed sections at an average
interval of 32.3 seconds, with a longest gap of 76.6 seconds. The page polls
every 1.5 seconds; model work, not the intentional polling interval, dominates.
Two saved-source extraction comparisons reduced input tokens by approximately
20% with lossless text packaging, but timing and citation quality were mixed.
That experiment is not accepted into the product. A separate two-section
sample combined routing and paragraph checks within each original section:
14.6 seconds became 10.3 seconds in one case; 11.5 became 10.8 in the other.
Both retained the observed family assignments and every paragraph disposition.
This small sample does not prove legal accuracy or whole-agreement speed.
Investigation is now deferred to the future-feature list below. No experimental
prompt or processing change is adopted. Do not group sections by assumed legal
relatedness or remove source context to improve speed.

The saved sixth-run replies now compile without the original section-wide
abort in sections 1.6, 3.12 and 3.13. Section 1.6 has two mechanically valid
proposals after unambiguous role-key case correction. Section 3.12 retains six
invalid proposals; section 3.13 retains seventeen proposals, six mechanically
valid, and explicit unsupported-classification issues. Original replies remain
unchanged. These are parser and citation checks, not confirmation of legal
accuracy. Genuine missing roles, grouping defects and unresolved coverage remain.

The seventh diagnostic exposed a review-control gap: acknowledging a group
mismatch could leave an accepted fact in an incompatible summary group. The
reviewer can now explicitly choose a compatible recorded group or make the fact
standalone. No automatic regrouping occurs. Original proposals and exception
links remain intact. The screen, server and database reject incoherent accepted
groups; a finding acknowledgement cannot bypass this check. Save, cancel,
keep-current and revision restoration are checked. The disposable database
change preserves existing review data and denies anonymous access.

A further review-control gap affected fact relationships. Only model-proposed
exceptions were separate review items, and the lawyer could not correct their
endpoints or type or add a missing relationship. The local candidate now makes
every typed model relationship explicit review work. It permits one source-linked
lawyer addition or edit with reviewer-selected fact endpoints, including added
facts, and a relationship type permitted by the legal schema. Original model and
lawyer-added relationship records remain unchanged beneath later edits. Missing,
invalid or ambiguous endpoints, types, source closures and source spans fail
closed. Older draft reviews gain each missing raw relationship as pending work;
published snapshots and prior releases are not rewritten. The review screen uses
plain relationship labels and starts additions with no preselected legal choice.
The starting fact limits the type choices to its declared legal relationships.
The server also computes relationship coherence before the screen can enable
publication. Focused state and interface checks pass. The full disposable
database migration chain and relationship access checks pass. A local browser
check covers blank addition, permitted type choices, edit, exact source display
and saved-state restoration. The private preview is deployed. The actual
105-section draft now assembles and opens in the private review page.

Diagnostic history: the private online Codex worker has passed a real
model call and a stop-and-resume authentication check. The first Public Storage
diagnostic saved all 105 sections, but 92 did not reach extraction because three
references to a separate agreement were treated as missing merger-agreement
sections. The database row limit, finalisation timeout and document-reference
distinction are corrected. A fresh diagnostic was submitted through the
ordinary `/review` form and automatically resumed the online worker. Its first
section has a complete source context and two saved proposed facts. The prior
run and its document structure remain unchanged. Full draft usefulness is
still unproved. The fresh run then stopped because the model supplied a
one-element list instead of a scalar relationship type. A read-only model
probe reproduced that exact response shape; no legal meaning is in dispute.
The response-format correction, website counter's lost-run-identifier fix and
party-name display correction pass their focused checks. The combined active
product suite passes. Completed, parsed model replies now persist before fact
compilation, with distinct failed-attempt history and token totals counted once;
database replay, rollback and access checks pass on the disposable database.
Provider failures and replies rejected before parsing remain outside that
retention correction. The earlier lost replies cannot be recovered, so this
diagnostic's total model usage remains incomplete. The corrected private
preview is live. Ordinary browser Retry resumed the saved run, preserved the
completed section and advanced the counter without a page reload. New parsed
replies are saved while their section is still processing. The run subsequently
stopped at 5 of 105 sections: the model supplied non-verbatim citations and
proposed unrelated definitions from imported context as facts of section 1.6.
All three failed attempts and their usage are retained. Shared routing is
corrected. The initial section-ownership rule proved too narrow in the next
live diagnostic, as described below. Bad quotes remain invalid proposals;
source context is not substituted for missing citations. The ordinary editor
now permits explicit citation repair and completion of missing required roles.
Local browser checks cover save, cancel, restore and save failure. The isolated
database check preserves the original proposal and rejects forged citations and
unrepaired publication. The database correction is applied only to the
disposable preview database; its three existing runs remain unchanged. The
hosted worker now supports two independent section workers inside its existing
single-process lock, with tested failure drain and bounded idle polling. The
combined product checks pass after correcting test adapters that selected a
foreign duplicate instead of an identical quote owned by the analysed section.
The next ordinary submission created generation 4 with a new prompt-bundle
identity. Two workers processed separate sections concurrently. The run exposed
an error in the ownership rule: it rejected exact quotes from the analysed
section's own numbered subclauses. The run was deliberately stopped after 9 of
105 sections completed. Its source, proposed facts and model replies remain
saved. Two interrupted sections and the run are marked failed with the reason;
the stopped worker retains its separate sign-in. The correction recognises
authored subclauses through the document's parent-child structure while still
excluding unrelated imported text. Read-only replay of the saved replies for
sections 1.1 to 1.4 now retains valid citations for 14 of 15 proposed facts,
previously 1 of 15. The non-verbatim quote remains invalid. This is a citation
handling check, not a lawyer's assessment of the proposed facts. The three
affected SEC integrations and the focused ownership checks pass. A fresh
generation will test the correction; generation 4 will not be retried under
changed rules. Received model replies rejected before parsing now persist with
known, partial or unknown usage identified honestly. Multiple Codex messages are
accepted only when a private final-message file identifies one unambiguous last
answer. Missing, stale, mismatched and ambiguous final output fails closed.
Received JSONL is saved even when Codex later exits with an error; empty transport
failures still cannot invent a provider reply. Focused checks, an actual Codex
0.145 event replay, the all-family recorded response check, the shared fake-runner
check and isolated database persistence pass. Ordinary Retry verified this
transport correction while preserving every prior completed section.
Generation 5 then completed three sections before section classification failed:
the model returned category objects instead of selected category names. All
replies were saved. The instructions now specify the exact JSON structure,
rather than presenting the full category catalogue as example output. Three
real model probes, including both failing sections, return the required shape;
the all-family recorded checks and real Concho/Modiv integrations pass. A second
worker's later failure also changed the stopped run back to a partial status.
That status calculation now preserves the exhausted failure after another
worker fails or completes. Five database checks pass, including ordinary
completion and duplicate-call accounting; the manager independently repeated
the four failure checks. The review screen passed browser checks with the real
proposal and source panels: failed quotes, background context and selected
citations remain distinct, and cancelled or failed edits preserve saved state.
A separate correction to later review revisions now preserves accumulated
draft review time while excluding time already published. Restore retains the
live clock, and reliable older sessions are reconstructed from saved history.
The existing release evaluation now requires an explicit final-fact link or
reasoned omission to resolve an original model finding. Bare acknowledgement
does not clear it; work that never ran and actual published contradictions
remain blocking. Database and browser checks pass. Processing time and the
fixed 90-minute limit remain unchanged. The seventh diagnostic reached 104 of
105 sections. Its last section failed three times because residual paragraph
identifiers were missing or unknown. The raw replies remain saved. The compiler
now retains unknown returned rows as open warnings linked only to the containing
section for context, not to a guessed paragraph. Missing supplied paragraphs
remain unresolved. No identifier is inferred from text, order or similarity.
Replay of all three saved residual replies, focused recovery checks and the
all-family recorded fixtures pass. The ordinary retry completed the final section
with the other 104 saved sections preserved, but draft assembly then timed out.
Reading saved model replies in smaller pages fixed that timeout without omitting
any reply or changing its contents. Final assembly then succeeded from the 105
saved sections, with the same 369 recorded model calls. A reverse source-span
lookup index reduced the measured full review-data database read from 5.12 to
1.34 seconds with identical response content; rollback and access checks pass.
Status refresh now permits one request at a time, shows failures with a read-only
retry and ignores late responses from an old or closed page. The live draft and
selected source context open. An earlier browser exception is not currently
reproducible; no unproved rendering fix is claimed. This is diagnostic repair
only. No blind test has established full processing under these corrections.
The 90-minute check now includes measured processing time. This is
diagnostic work, not blind release evidence. The untouched final agreement,
independent lawyer inventory and fixed release bars remain outstanding.
Preview processing continues after the browser closes. If the entire worker
stops unexpectedly, reopening Review or choosing Retry wakes the saved database
run. Automatic scheduled recovery has not been proved.

Before opening the blind agreement, freeze the schema, prompts, release bars
and expected lawyer issue list.

The existing final-candidate record now identifies the working hosted Codex
configuration (`gpt-5.4-mini`, low reasoning) and routing/citation prompt version
4. The schema, legal-review rubric and release bars are unchanged. The combined
active product run found three obsolete test expectations; their affected
behaviour checks now pass after test-only corrections. Metadata-only file-hash,
correction-count and source-text checks were removed as required by section 9.
Ben supplied independent notes before seeing model output, first on conditions,
termination and fees, then on access, no-shop, employee protection, interim
operations and regulatory efforts. His notes deliberately stop short of the
whole agreement and do not assign severity to each point. They are sufficient
to identify extraction failures, not to claim complete independent recall or
lawyer acceptance. AI-derived additions must remain distinct from those notes.
The frozen untouched Olaplex run started through the ordinary interface at
23:30 UTC on 2026-09-05 and reached READY at 00:06:11 UTC on 2026-09-06,
with all 79 sections complete. No legal attestation or production cutover has
been performed. Processing completion alone does not satisfy the phase exit
condition or establish the combined 90-minute processing and review bar.

The 2026-09-06 read-only comparison uses the original run
`068d9468-1b7e-42da-b4fb-2aa5663dc1ad`. It has already established:

- Section 5.1 has twelve saved restrictive-covenant proposals, but no proposal
  for the affirmative ordinary-course/efforts or goodwill-preservation duties.
  The raw completed model response has the same omission; this is not display
  loss or a truncated response.
- Section 5.2 proposal `8b063c62` covers access but omits the separate cooperation
  and information-furnishing duties and several exceptions and qualifications.
- Section 5.3 proposal `1e36b6e` bundles five no-shop prohibitions, but its selected
  citation ends after the first. The permitted-action proposal also fails to
  retain the full timing and information-sharing requirements in usable form.
- Section 5.8 proposal `9af6bf6b` combines the four employee protections, loses
  the other-benefits-only aggregate comparison and places the exclusions in a
  combined qualification. The saved source still contains the distinction.
- Section 5.5 retains filing timing but lacks a separate remedy-efforts limit.
  Its acquisition restriction omits the numeric, geographic and business-scope
  details from the proposed fact. Several other proposals are explicitly
  invalid because their supplied evidence quotes are not exact.
- Sections 6.1 and 6.3 expose missing general closing-condition support for the
  information-statement waiting period and the TRA waiver. Exact model text
  for the waiting period and no-MAE condition survives in held issues. The
  latter uses an unsupported subtype even though its fact type is supported.
- Sections 7.1 and 7.3 expose a shared numeric validator defect: it checks only
  the first citation, falsely invalidating values supported by later exact
  citations. Some proposed relationships also misstate independent conditions
  as extensions or omit the operative termination/fee dependencies.
- The old fee/remedies family-ownership hold must not prevent capture of the
  paid-fee remedy limit that Ben expressly identified. Store it once with its
  actual conditions and linked fee, without treating a storage-category choice
  as a new question about legal meaning or as final lawyer acceptance.

The correction must preserve independently operative duties, source-authored
qualification scope and useful support for every material part. It must not
weaken exact-citation checks, invent legal meaning from keywords, alter the
original run, or mark an AI comparison as a lawyer decision. Most distinctions
fit existing roles; the general closing-condition and remedy-limitation gaps
need additive schema support. A prompt change must be tested on actual model
output, not only on a changed prompt string. The source also separates the
Section 5.5(e) remedy-efforts exemption from the later competing-acquisition
restriction: its dollar, country and Relevant Business limits qualify the
latter, not the former. Keep this source clarification separate from Ben's
original shorthand.

The shared correction now adds a neutral general closing-condition type and a
paid-fee remedy limitation under Remedies. The existing schema interface remains
V1; its content revision is V1.1. Compiler tests retain both new conditions and
the conditional negative remedy as proposed, source-linked facts. Missing roles
remain unresolved. No test makes a lawyer decision. Numeric validation now
checks all selected exact supporting quotes, not only the first. Conflicting
values and model-value mismatches remain invalid. Replaying the original saved
fee and two cure-period citations clears their false numeric rejection; the
tail still has a model-value mismatch and is not claimed fixed.

Required shared-change checks passed: all-family recorded fixtures, including
the real Modiv source-to-review replay, and 22 focused schema, structure and
intake checks. Modiv still rejects 72 of 114 recorded proposals and permits 42;
this proves rejection and review behaviour, not acceptable legal recall.
Fresh mini/low model comparisons are diagnostic work on the exposed Olaplex
source. They are checking distinct duties, local qualification scope, complete
citations and useful relationships before the corrected candidate is frozen.
The final V5 access replay took 50.1 seconds and returned seven proposals, but
still omitted the privilege, trade-secret, competing-proposal and law exceptions.
Two duty citations spliced non-contiguous source passages and remained invalid.
Its relationship output was also defective. The root rejected this as a completed
release fix. A single same-prompt mini/medium diagnostic will test whether the
next reasoning setting improves these failures. No live model setting changed.
The mini/medium access replay took 204.2 seconds and captured more legal detail,
but returned broken group references, incorrect quote-occurrence indexes,
under-supporting citations and no relationships. It is not a usable release
result. The final mini/low employee replay also retained the four compensation
standards but failed group references and still compressed later provisions.
Raw responses were saved before compilation; neither replaced the original run.
One bounded Sol/medium diagnostic used the already-installed newer CLI to
test whether a more capable model could satisfy the same extraction request.
The first Sol diagnostic returned an error item after about 129 seconds, not
usable model JSON. The old parser mislabelled this as a forbidden tool. Error
items now remain failed turns with bounded provider context; the focused CLI
checks pass and actual tool events still fail closed. The controlled repeat
failed because Sol requires Code Mode under that CLI setup. The tool-free
extraction policy was not weakened. The raw failure was retained.

GPT-5.5/medium then completed the same exposed-source access request in 126.2
seconds. Its 14 proposed facts retained the noted exclusions and workarounds,
with exact source quotes and useful local links. Employee matters took 145.7
seconds and returned 18 valid proposals, but still compressed the two distinct
benefit-exclusion lists and omitted some relationships. The no-shop diagnostic
first hit its five-minute diagnostic limit; a single repeat using the existing
ten-minute product limit completed in 311.1 seconds. Its 38 proposals include
31 valid and seven held proposals. In Ben's 5.3(a)-(b) slice, all 13 proposals
passed mechanical validation, but review found incomplete governing citations,
lost representative wording and an over-broad statement of a named-act-only
condition. Exact quotes alone do not prove legal accuracy. No diagnostic
replaced the original Olaplex run or establishes a release pass.

The generic scope instruction now requires governing source quotes, distinct
promise/comparator exclusions, exact actor-control and time scope, and retention
of any act-specific condition limit. New candidate model selection will be
fixed by call kind in the run identity: mini/low for routing and residual checks,
GPT-5.5/medium for extraction. A small tool-free probe also confirmed GPT-5.5
works with the existing 0.145.0 CLI; no CLI or authentication change is required
merely to select that model. Full integrated-candidate behaviour remains to test.

An undeclared group reference must retain the offending raw proposal and touching
links as open, source-linked review issues, not discard the whole section or
guess group membership. Valid sibling facts must survive. The implementer also
confirmed that user-edited cross-section relationships already work in Review,
but model-proposed links are constrained to one section during compilation,
validation and persistence. The shared correction now resolves model-specified
exact cross-section targets after section processing, without another AI call
or copied facts. Missing, ambiguous or unsupported targets and relationship
proof remain unresolved. The seven focused JavaScript checks and two local
database checks passed, including forged-source rejection, access restrictions
and migration rollback. The shared recorded replay passed again, with the same
42 valid and 72 held Modiv proposals. The two additive storage migrations were
applied only to the disposable database. Public and signed-in direct execution
remain denied; only the worker role can stage links. Production is unchanged.
The new schema revision and V2 links also survive finalisation and reopening;
legacy drafts retain their old identity. Two local database round-trip checks
passed. Hour periods retain their unit, update duties do not acquire an invented
duration, and mixed units or conflicting values remain unresolved. Fourteen
focused schema and compilation checks passed. The wider active suite found
three old assertions that accepted Concho's shorter-of-one-Business-Day-or-48-hour
notice as a single one-day scalar. Those assertions now require the proposal
and related coverage to remain unresolved. The 282 unaffected checks passed;
the three affected checks passed after correction. The all-family recorded
replay passed after the final shared parser and schema change. All four additive
storage changes are applied only to the disposable database. This changes no
legal acceptance requirement.

The fresh V5 no-shop diagnostic took 312.9 seconds and returned 38 proposals:
36 mechanically valid and two held. It now retains the governing actor and
time wording, but still combines three separate permitted actions into one
proposal. This risks attaching an information-only condition to other actions.
It is not a legal-quality pass. Two unsupported relationship types remain open,
and one notice-period proposal lacks its numeric supporting quote. A separate
false rejection treated an Article 7 reference as an unsupported period value.
The parser now ignores that reference without supplying missing evidence or
changing any duration. All 25 affected period and recovery checks pass. The
saved model response and original Olaplex run remain unchanged. The next full
run on exposed Olaplex is an integrated diagnostic, not another blind test.

- [x] Run the release candidate on the untouched blind agreement.
- [ ] Compare it with an independent, atomic lawyer inventory.
- [ ] Measure severity-weighted precision and recall, citation sufficiency and
      narrowness, duplicates, contradictions, unresolved burden and review
      time.
- [ ] Count `UNRESOLVED` against recall and review burden.
- [ ] Fix shared release-blocking failures once.
- [ ] If the blind agreement drives a fix, test the corrected candidate on a
      new untouched final agreement. Do not reuse the exposed holdout as proof.

Draft-quality diagnostics:

- severity-weighted recall and precision against the independent inventory;
- citation sufficiency and narrowness;
- duplicate and contradiction rate;
- unresolved count; and
- model cost, run time and lawyer review time.

These figures guide later automation. They are not hard release claims from one
blind agreement.

Supervised internal-release bars:

- the lawyer's independent critical and material inventory is fully reconciled
  into published facts or explicit reviewed omissions;
- 100% of published facts have exact and legally sufficient citations;
- 100% of substantive sections and required roles have a coverage state, every
  exception has been reviewed, and the lawyer has given one agreement-level
  coverage confirmation;
- zero contradiction remains inside a published proposition group;
- zero `NOT_RUN` or `UNRESOLVED` item is presented as absence or completion;
- 100% of final published facts are lawyer accepted; and
- a standard agreement can be processed and reviewed in no more than 90
  minutes without a developer.

The bars are fixed before the blind run. A weaker bar needs Ben's explicit
decision because it changes what the product promises.

Exit: the frozen candidate satisfies every supervised internal-release bar on
the untouched blind agreement or, if the blind result required a shared fix,
the corrected candidate satisfies every bar on a new untouched final
agreement.

### Phase 6. Internal cutover and live use, 2 days plus one live deal

- [x] Take a database backup and restore it to a separate environment.
- [ ] Load the reviewed candidate through an inactive release pointer.
- [ ] Compare the rendered V1 and V2 result. Explain differences rather than
      requiring false equality.
- [ ] Switch private Review to the accepted V2 release.
- [ ] Run an outside-in smoke test.
- [ ] Execute rollback once and prove the prior view returns.
- [ ] Restore V2 and process one current agreement through the user interface.
- [ ] Fix any release-blocking defect and repeat only the affected check.

Exit: Ben uses the reviewed summary on a current agreement. Review is the
released product. Compare and Query remain on their existing path until they
are adapted to the stable accepted-fact contract.

## 7. Not required for internal release

- Autonomous AI publication.
- A second AI corroborator.
- Forty agreements.
- Three to ten calibration provisions for every family.
- Per-family certificates or receipts.
- Frozen digests of plans, fixtures and review documents.
- Re-proving immutable historical runs after unrelated changes.
- V1 parity where V1 has no comparable fact.
- External-product certification.
- Compare and Query migration.
- A separate programme-status application.

Add any of these later only when a concrete product need justifies it.

### Features to improve later

This is the future-feature list, not launch work. Update each feature here;
the online status page displays the same entries. Status starts as Deferred,
then can become Investigating, Building or Done. Do not count these entries in
the Phase 0 to 6 checklist. The features below are for after external launch.

| Feature | Status | When | Intended outcome | Next step |
|---|---|---|---|---|
| Faster agreement processing and review | Deferred | After external launch | Shorter section and agreement processing, development feedback and future merger-agreement review, without reducing legal coverage, citation checks or required lawyer review. | Revisit measured model time, repeated input, retries and worker waiting. Compare combined checks within each existing section and safe parallel work. Do not infer section relatedness or omit context. Current small comparisons are recorded in Phase 5. |
| Precedent tracing and clause-level markup reuse | Deferred | After external launch | For an uploaded agreement, rank likely source precedents across the stored corpus. Detect multiple source agreements at section and clause level, including representations from one precedent and interim covenants from another. Link a matching representation or other clause to relevant prior markups. | Compare several methods: stable miscellaneous provisions, distinctive wording, section and clause similarity, and changes between versions. Show supporting text, differences and uncertainty; similarity is evidence of a possible source, not proof of drafting history. Keep source attribution separate from advice to accept a prior markup. |
| Compare exact covenant wording under common labels | Deferred | After external launch | Group comparable duties under a short common label while retaining the exact authored verbs, qualifiers and source locations, so small drafting differences remain visible across agreements. | Start with no-shop verb lists. Keep words such as solicit, initiate, knowingly encourage and facilitate distinct in the source-backed representation. A common label must not imply legal equivalence or replace the operative wording. |

## 8. Core-document reset

The seven current core files total 10,649 lines. They mix rules, history,
measurements and stale execution state. A new agent must not re-read the whole
programme before changing the product.

Keep four live documents:

1. `PLAN.md`: a short pointer to the named dated implementation plan below.
2. `OPERATING-RULES.md`: source safety, legal escalation, runtime security,
   verification and cutover rules only.
3. `LEGAL-RULES.md`: the concise substantive legal decisions used by the
   current legal schema.
4. `CODEBASE-GUIDE.md`: a current source-to-screen map, kept under 250 lines.

Exact treatment:

| Current file | Lines | Treatment |
|---|---:|---|
| `README.md` | 59 | Rewrite as the short four-document entry point. |
| `OPERATING-RULES.md` | 1,031 | Replace. Keep only controls that prevent a named product, data, legal or security failure. |
| `PLAN.md` | 1,667 | Replace with a short pointer to the named dated implementation plan. |
| `CODEBASE-GUIDE.md` | 1,628 | Replace in Phase 0 with the active contracts and update after Phase 3 with the complete path. |
| `COMPLETED.md` | 1,824 | Move to history. Search only to avoid rebuilding existing code. |
| `DECISIONS.md` | 2,358 | Move to history after extracting live legal rules and the five-step cutover. |
| `GRAVEYARD.md` | 1,082 | Move to history. Search only before reviving or deleting old code. |

Remove `Archive.zip` from `docs/core`. Shorten `CLAUDE.md` so it points to the
four live documents. Mark `docs/CODEX-PROGRAM.md`, `programme-gates.yaml` and
the specification manifest as historical for this build. Dated notes remain
evidence, not instructions, except
`docs/codex-program/notes/PRODUCT-LAUNCH-IMPLEMENTATION-PLAN-2026-09-04.md`.
That named dated plan is the single executable plan and checklist.

Git preserves the old versions. Moving them out of the live set does not erase
history.

## 9. Lean verification and CI

Every check must name the failure it prevents. Remove a check if it only proves
that a receipt, digest, import list or plan matches itself.

### Current cost to remove

- CI is 717 lines and can start 12 to 15 separate dependency installs per pull
  request.
- There are 439 phase allowlists.
- The test estate contains more than 1,000 files. Most Canonical V2 and Stage
  2Y tests assert historical receipts, authorities, manifests, hashes or
  frozen topology.
- One recent successful pull request consumed 129 runner-minutes and took
  about 51 minutes after runners started. Historical baseline re-derivation
  used 32 minutes.
- A recent failed pull request spent about 15 minutes before an obsolete
  candidate-registration digest test failed. It did not test SEC ingestion,
  legal accuracy, citations, rendering or access.

### During implementation

- A leaf prompt or parser change runs its family fixtures.
- A router, provider, shared resolver, schema or context change runs all-family
  recorded fixtures.
- A UI change receives one browser check of the changed flow.
- A persistence change runs against an inactive local or staging database.
- Each phase boundary runs the furthest real active product boundary that the
  phase owns. From Phase 2, when the new source-to-review interfaces exist,
  each phase boundary runs the real SEC-source-to-review integration test.
- Repeat a failed check after a relevant fix. Do not repeat an unchanged pass.

### Required pull-request CI

1. Active product behaviour tests: SEC identity, revision classification,
   UTF-8 spans, state transitions, required roles, relationships, coverage,
   persistence, authentication and source-to-review integration.
2. Production build.
3. Direct secret and authentication checks.
4. Database migration and rollback test only when database code changes.

Run one CI workflow per pull request. Do not run a duplicate branch-push copy.
Run the full active product suite at integration boundaries and cutover.

### Remove from blocking CI

- phase detection and all phase allowlists;
- specification byte-length and digest checks;
- authorities, registrations, receipt chains and sealed-topology tests;
- source-code regular-expression checks;
- the custom test sharder and its pinned test hashes;
- no-op invariants;
- full historical corpus re-derivation on routine changes;
- jobs that report green after silently skipping for missing credentials;
- V1 parity as a universal gate; and
- M0-to-M10 acceptance tests.

Keep historical replay, near-miss and baseline tools as optional diagnostics
during transition. They do not block delivery. When an old test protects real
behaviour, rewrite that behaviour at the new interface, then remove the old
test and machinery in the same change.

Runtime controls remain: SEC host and redirect policy, immutable source bytes,
UTF-8 span checks, idempotent writes, authentication, least-privilege database
access, atomic release pointers, audit history, backup and rollback.

## 10. Sol Manager Loop

Follow Matt Shumer's Manager Loop closely. Use Sol for both roles in separate
Codex tasks.

### Set-up

1. Start a Sol task called the manager.
2. Put the manager in `/goal` mode with the whole internal-launch outcome.
3. The manager adopts this checklist, updates it in place and owns it for the
   full build. It does not create a second planning document.
4. The manager immediately starts a second Sol task called the implementer.
5. Put the implementer in `/goal` mode for the current phase.
6. The manager and implementer communicate directly through task messages.

### Exact phase loop

For Phase 0, the manager sends the implementer:

```text
/goal Complete Phase 0 of
docs/codex-program/notes/PRODUCT-LAUNCH-IMPLEMENTATION-PLAN-2026-09-04.md
completely, extremely well.
Do not stop until every checklist item and the phase exit condition are true.
Run only the checks required by section 9. Report changed files, observed
product behaviour, test results and any plan correction that repository
evidence requires. Do not create authorities, receipts, registrations, new
programme gates or duplicate status documents.
```

When the implementer finishes, it messages the manager. The manager checks the
diff, product behaviour and phase exit condition. It accepts or rejects any
plan correction. It then sends the same command for Phase 1. The loop repeats
through Phase 6 without waiting for Ben unless section 11 requires him.

Use the same implementer across phases, as in the post. If its context grows so
large that progress or judgement degrades, the manager starts a fresh Sol
implementer with the checklist, current interfaces, actual outputs and open
issues. This is a recovery action, not the default process.

The manager can start additional Sol subagents for bounded, independent work,
but the manager and primary implementer remain the two owners. No agents edit
the same files.

The wording is "extremely well", not "perfectly". The phase moves when its
exit condition is true. It does not expand into unrelated polish.

This file is the one checklist. Do not build a second HTML tracker unless the
manager finds that visible checklist progress is actually being lost. If that
happens, generate a read-only page from this file. Do not maintain two states.

If progress stalls, the implementer reports the exact blocker and evidence.
The manager narrows, reassigns or escalates the work while other safe tasks
continue. Do not abandon a necessary diagnosis only because a clock expired.

The plan may change when code evidence makes it wrong. Release bars cannot be
weakened after the blind result without Ben's explicit decision.

## 11. Decision boundary

The Sol manager decides module design, prompts, schemas, identifiers, storage,
sample construction, thresholds, test design, task order, reuse, deletion and
documentation correction.

Ask Ben only when:

- two plausible readings of source language produce materially different legal
  output;
- a compact omission may hide a legal distinction;
- a published absence statement needs legal confirmation;
- release bars would need to weaken after the blind test; or
- production cutover needs explicit approval.

Complete all mechanical work before asking the smallest exact question.

## 12. Manager `/goal` prompt

```text
/goal Own the Precedent Machine internal product launch through completion.
Start from docs/codex-program/notes/PRODUCT-LAUNCH-IMPLEMENTATION-PLAN-2026-09-04.md.
Phase 0 promotes it to docs/core/PLAN.md. Adopt its checklist and update that
single checklist in place. Immediately start a separate GPT-5.6 Sol implementer
task and put it in /goal mode for Phase 0 with this exact instruction:
"Complete Phase 0 completely, extremely well." When it finishes, verify the
actual diff, product behaviour, tests and exit condition, then send Phase 1.
Repeat through every phase. Keep safe, non-conflicting work moving. Let the
implementer propose plan changes
when repository evidence proves the plan wrong, and decide whether to accept
them. Judge progress by the working SEC-URL-to-reviewed-summary product, not
documents, receipts or test counts. Do not stop for a completed phase, passing
test or completed subagent. Stop only for a genuine legal ambiguity, a proposed
weakening of the blind release bars, or the final production cutover approval.
```
