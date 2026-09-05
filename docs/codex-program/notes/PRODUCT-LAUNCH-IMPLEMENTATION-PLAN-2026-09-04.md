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

Current position, 2026-09-05: the private online Codex worker has passed a real
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
preview and ordinary browser retry still need verification.
The 90-minute check now includes measured processing time. This is
diagnostic work, not blind release evidence. The untouched final agreement,
independent lawyer inventory and fixed release bars remain outstanding.
Preview processing continues after the browser closes. If the entire worker
stops unexpectedly, reopening Review or choosing Retry wakes the saved database
run. Automatic scheduled recovery has not been proved.

Before opening the blind agreement, freeze the schema, prompts, release bars
and expected lawyer issue list.

- [ ] Run the release candidate on the untouched blind agreement.
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
