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

Current position, 2026-09-12: Ben has reviewed the NCS draft and decided on a
rebuild of the fact model (Phase 5B). Phase 5's remaining items now apply to
V2 output. The V1 NCS review state (revision 45) is kept as the comparison
baseline. Phase 6 waits for Phase 5B and the Phase 5 exit.

Earlier position, 2026-09-07: NCS completed ordinary private intake in
118 minutes 26 seconds with the corrected code. All 104 sections have saved
results and section coverage records, with no missing or unexpected section
identities and no failed sections. There are 53 unresolved coverage records
awaiting review, not necessarily 53 distinct legal issues. The complete
[NCS draft is now open for review](https://deal-corpus-git-codex-product-imp-7fe402-codenamehashs-projects.vercel.app/review/product/eaafcac8-790b-41bb-a5e1-b12187a55e7d),
following Ben's approval below. It shows 104 section cards and 1,672 items
awaiting review. Agent preparation is not Ben's legal review or acceptance.
Known agreements will check mechanical corrections; a new agreement is not
required after every such correction. Ben has now approved using his existing
independent provision samples instead of a separate full lawyer inventory.
Review the complete NCS draft with him now, before any more agreement runs.
All other publication requirements remain unchanged.

Ben's first pass, 2026-09-12: Ben reviewed the briefed NCS provisions on
the focused page and saved 35 comments, 2 edits and 3 unresolved marks
(revision 45). All are recorded verbatim in
`docs/codex-program/notes/BEN-NCS-REVIEW-COMMENTS-2026-09-09.md` and
consolidated in `docs/codex-program/notes/NCS-REVIEW-IMPLICATIONS-2026-09-12.md`.
The consistent instruction is finer, systematic tracking: each list element,
standard, threshold and qualifier as its own comparable item under the
fact, with inherited chapeau language marked, forced roles made optional,
several subtypes renamed, covenant standards tracked, bring-down rep lists
resolved, and cross-references resolved to content. That is a schema,
prompt and data-model change needing an untouched agreement afterwards.
Three direction questions are put to Ben in the implications note. No
review decision was made or changed by the assistant. The two edits carry
bracketed notes in role fields and should not publish as they stand.

Review save timeout and comments, 2026-09-12: Ben reported Accept and
Reject did nothing. Runtime logs showed every review POST failing with a
Postgres statement timeout inside `product_phase3_save_review`. Measured on
the private preview database: the validation chain alone takes 2 to 13
seconds for the 1,672-item NCS state, against the 8 second limit inherited
from the authenticator role; individual queries are fast, the cost is the
chain of wrapper functions on a small instance. Mechanical corrections:
`ALTER ROLE service_role SET statement_timeout = '60s'` applied to the
preview database and recorded in
`supabase/migrations/20260912190000_product_service_role_statement_timeout.sql`;
the review API route now declares a 60 second function duration. No
validation rule was weakened. Also added, presentation and review-state
only: a `COMMENT_ITEM` command that stores a lawyer comment on a review
item without changing its decision; decision colouring and a decided count
on the focused view; a reviewer brief (`lib/product/review-briefs.js`) that
opens the NCS run on the briefed provisions with a "look for" line per
section (`?all=1` shows everything). Unit and display tests pass; build
passes; a local browser round trip of accept, reject and comment passed
against a fixture. A live save on the deployed page is Ben's next click;
runtime logs will show whether it now completes.

Preview database binding, 2026-09-12: the focused view was first pushed to
`claude/festive-albattani-70cwn5`. That branch's Vercel preview built, but
its review API returned 500 because the deployment's database environment
does not point at the private preview database (`product_run_access` was
missing; the error hinted at an old production table). Only
`codex/product-implementation-plan-20260904` carries the environment that
reaches the private preview branch database. The four commits were
fast-forwarded onto that branch, so the stable codex preview URL is again
the live review. Nothing in the database changed.

Focused review view, 2026-09-09: Ben asked for a page closer to the old
review, showing the provisions selected for discussion. A presentation-only
focused mode now opens when the Review URL carries `?focus=7.1,7.3,...`:
each selected section shows the provision as written beside the draft's
facts in source order, grouped by proposition group, with a click on a fact
highlighting its cited words in the text, held model content listed as
"not shown as facts", and the full card (roles, citations, edit) behind a
toggle. "Show all sections" returns to the complete page. Files:
`components/product/FocusedReview.jsx`, `lib/product/section-highlight.js`,
`pages/review/product/[id].js`, `components/product/ReviewWorkspace.jsx`,
test `tests/product-focused-review-ui.test.js` (added to `test:active`).
Checks: focused, presentation, held-issue, proposal-card-source and
first-load display tests pass (39 of 39); `npm run build` passes; forbidden
patterns pass; one local browser check of login, focused view, click-to-
highlight, card expansion and return to all sections passed against a
fixture built from the real 7.1 text, with throwaway local auth values.
The active suite ran 352 of 353; the one failure is the Codex client
temporary-file permission test, which does not touch this change. No stored
content, review decision, prompt, model or database changed.

Ten-provision briefing, 2026-09-09: Ben chose comment-style review of a
few material provisions rather than all 1,672 items. Ten provisions
(termination, fees and remedies, no-shop, board recommendation and match,
closing conditions, specific performance, regulatory efforts, Material
Contracts rep with thresholds, written consent and support agreement, and
an interpretation control) were read from the private database against
their source text in
`docs/codex-program/notes/NCS-TEN-PROVISION-BRIEFING-2026-09-09.md`. The
database is the Supabase preview branch `pm-product-restore-20260905`.
Findings: closing conditions and fee amounts are accurate; written-consent
mechanics and support-agreement terms are systematically labelled with
vote-deal subtypes; the Parent Termination Fee election right and every
Material Contracts dollar threshold are held as unsupported subtypes and do
not appear as facts; the Acceptable Confidentiality Agreement definition has
no fact. Ben's comments are recorded verbatim in
`BEN-NCS-REVIEW-COMMENTS-2026-09-09.md`. No review decision was made.

Review page adversarial review, 2026-09-09: Ben opened the NCS draft and
reported that 1,672 items is too many, that cards repeat, that clicking a role
highlights the whole provision, and that the reader-facing result is unclear.
The code-level review in
`docs/codex-program/notes/ADVERSARIAL-REVIEW-NCS-REVIEW-PAGE-2026-09-09.md`
confirms each point from the rendering code and prompt: role links all open
citation 1 of the fact because citations are per fact, not per role; the
schema marks every provision in 22 of 25 families material and the prompt
demands one proposal per operative effect with repeated qualifications; the
published summary is the same atomised list grouped by family, and
`summary_grammar` is never used to compose it; every item must be individually
decided before publication. Presentation fixes are safe now. Materiality and
reader granularity are Ben's decisions under section 11 and are open. No
review decision, stored content, prompt or model changed. The private
database was not reachable from the reviewing session, so NCS counts were not
re-verified.

Review presentation correction, 2026-09-07: Ben reported that proposed facts
were not apparent and the page displayed machine codes. The live page contained
1,039 non-empty proposal cards, but the first was about 35,700 pixels below the
top because agreement-wide coverage and relationships came first. This is not
an adequate lawyer-review handoff. Correct the presentation so proposed legal
sentences and source links come first, sections are easy to reach, and visible
labels use plain English. Keep every coverage, exception and relationship
check accessible with honest outstanding counts. Do not change stored legal
content, review decisions or publication requirements, and do not rerun the
agreement for this display correction.

The presentation correction now places proposed facts first, adds section and
review-check navigation, and replaces visible code labels with readable text.
Coverage checks remain available behind an expandable heading; other findings
and relationships remain in the review-checks area. The directly affected
display and source tests pass. A representative 104-section browser check
showed the first fact in the first screen and verified section navigation.
No extraction, database or review-state change was needed. This corrects the
review handoff, not the outstanding legal review or Phase 5 exit condition.

Apogee finished all 95 sections through normal
private intake, without manual repair, in 100 minutes 17 seconds. Ben has
approved deferring speed improvements, so exceeding 90 minutes no longer blocks
the supervised internal launch. Timing remains measured and reported.
Ben has now supplied independent partial notes on seven selected provisions.
The sample comparison found that article introductions had no processing
record or coverage state, omitting Article III's disclosure qualifications.
The shared correction now includes both saved introductions, Articles III and
IV, and selects 97 sections rather than 95. Source-context and database checks
pass. The database correction is applied only to the private test environment;
the private website and online worker now use the corrected code. The original saved draft is
unchanged. The full Review page remains unopened, with no review decisions or
publication.
Arcellx's full party names, clear review counters and access to each saved
citation inside complete clause context are verified in the private view.
Independent lawyer review, coverage confirmation and publication remain
outstanding. Phase 5 is not passed. Every legal-review requirement is unchanged.

The final untouched processing candidate is NCS Multistage Holdings / Weatherford
International / Trinity Bell Sub, agreement dated 2026-05-31. The
[SEC filing index](https://www.sec.gov/Archives/edgar/data/1692427/000119312526252096/0001193125-26-252096-index.htm)
identifies NCS's 2026-06-02 Form 8-K and
[Exhibit 2.1](https://www.sec.gov/Archives/edgar/data/1692427/000119312526252096/d23867dex21.htm).
Selection used filing metadata, not agreement text or model output. Repository
text and Git object-name searches found no exact issuer, accession, CIK,
exhibit-filename or Weatherford matches. Those checks do not exclude copied or
renamed text. The private database had no prior run matching the CIK, accession
or exhibit filename. The corrected candidate keeps schema V1.2, prompt V6,
the existing routing and extraction models, two section workers, and the same
legal-review requirements. Ordinary private Review intake created run
`eaafcac8-790b-41bb-a5e1-b12187a55e7d` at 2026-09-07 01:45:13.815066 UTC.
The normal sign-in succeeded using Ben's existing credentials; no login flow
or credentials changed. At the first independently checked checkpoint, three
of 104 sections were complete, two were processing, and none had failed.
Review was left before completed output could open. Only run configuration,
status and counters are being monitored. No independent lawyer inventory or
legal acceptance is claimed for this new agreement.

NCS reached `READY` at 2026-09-07 03:43:39.709987 UTC, 7,105.894921 seconds
after submission. The original run completed without a manual retry, restart
or data repair. Four sections retried automatically and completed, with a
maximum of two attempts. Independent metadata checks found 104 expected leaf
sections, 104 completed work records, 104 saved results and 104 section coverage
records. Exact section identities match in both directions; none is missing
or unexpected. One final draft is saved. There are no review sessions, review
actions or publications. The schema envelope, prompt and model configuration
remain the same as the prior Apogee run. Processing completion is not legal
acceptance or evidence that every proposed conclusion is correct.

Coverage metadata contains 95 section records marked `FOUND`, eight marked
`NOT_FOUND` and one marked `UNRESOLVED`. Across section, family, fact-type and
paragraph levels, 53 of 8,814 coverage records are `UNRESOLVED`. These levels
can overlap, so this is not a count of distinct legal defects. None of these
states is lawyer-confirmed; `NOT_FOUND` is not a published absence statement.

The saved call records contain 97 extraction, 108 routing and 108 residual
calls, including retry history. They record 4,957,352 input tokens and 675,904
output tokens. The subscription provider records zero metered API cost; this
does not mean the run was free or measure the subscription cost attributable
to it. Lawyer review time and legal-quality measurements remain unavailable.
Ben's Olaplex and Apogee notes remain useful independent samples for those
agreements, not a completed inventory or acceptance of NCS. No further
agreement is needed solely to verify the mechanical introduction correction.

The earlier diagnostic accounts below preserve what happened and the rules in
force at that time. Their earlier full-inventory, pre-exposure and 90-minute
requirements are superseded by Ben's dated decisions in the current Phase 5
checklist and publication requirements below; they must not delay showing NCS.

After Ben's 2026-09-07 approval, the implementer opened the completed NCS draft
through ordinary signed-in Review. Revision 0 shows the complete party names,
104 section cards, 1,672 pending review items, agreement coverage and findings,
fact relationships, exceptions, qualifications and source controls. A Section
5.2 source check opened both the exact supporting passage and its full operative
clause context. No fact was accepted, rejected or edited; no coverage confirmation,
save, finalisation or publication was made. This is agent preparation, not a
lawyer review-time measurement. The initial view's zero items marked unresolved
counts review decisions and does not erase the 53 unresolved extraction coverage
records reported above. The page is large: targeted section/source interactions
work, while a complete accessibility-tree export exceeds the browser tool's
message limit. That export limit is not itself a product failure.

Earlier, Olaplex completed all 79 sections in about 36
minutes through ordinary private intake. Ben's independent, partial legal notes
have exposed missing duties, lost qualifications and insufficient citations.
Shared corrections are in progress. Cross-section relationship proposals now
pass source-ownership and database checks without another AI pass. Stronger-model
diagnostics capture more detail, but still lose some scope and citation context.
The corrected candidate is not accepted. The private candidate now retains
the smaller model for routing and uses the stronger model for extraction. Explicit
hour periods and non-duration update duties are retained in the data model.
The new full diagnostic stopped after 14 saved sections because different
proposals with the same supporting text received the same internal identifier.
The correction preserves each candidate as separate pending review work;
database checks pass. It is live in the private preview. Ordinary Retry resumed
the same run with all 14 completed sections retained. Section 5.1 contains no
proposed facts and remains unresolved for coverage. Its first extraction timed
out; the second completed normally with an explicitly unresolved empty reply.
Access, employee protections, closing conditions and termination rights retain
substantially more detail, including separate benefit standards and no added
continuing-MAE condition. No-shop still omits the cease-discussions duty's
information-provision limb. Section 7.2 also has no facts: the supplied
termination schema can express rights, dates and cure periods, but not notice,
survival, liability or remedies after termination. A shared additive schema
correction, V1.2 with extraction prompt V6, is accepted. One private full-context
7.2 check returned six distinct termination effects in 69 seconds, with exact
source quotations and the 7.3 qualification retained. It did not propose links
to facts in 7.3. This is a diagnostic result, not a replacement for the saved
analysis or lawyer acceptance. The review screen now clearly explains
an unresolved empty extraction using the existing coverage finding; source
controls and legal review requirements are unchanged. Focused interface tests
and a browser check of both review locations pass. These are assistant checks
against source and Ben's partial notes, not lawyer acceptance.
All 79 sections are now saved, with 816 proposals and 135 relationships. Draft
assembly exposed a mismatch: extraction retained unsupported relationships with
explicit findings, but assembly then rejected the entire draft for those same
relationships. The mechanical correction retains the links only with matching
open findings and still prohibits acceptance of the unsupported relationship.
Read-only replay of all saved results passes under the original V1.1 schema;
the original failure reproduces without the correction. Ordinary Retry now
assembles the saved draft successfully, with all 79 saved result identifiers
and contents unchanged. Opening Review exposed repeated database scans while
creating its 1,348 pending items. A single identity lookup replaces those scans
without removing validation or increasing the eight-second limit. Inactive
database checks cover missing, duplicate and altered items and migration
rollback. Ordinary Review loading now creates revision zero with all 1,348 items
pending and no legal decisions. The first load also exposed an incomplete API
response; refetching the complete review record corrects that browser error.
The missing-fact form now supports several exact stored source passages, with
full-text controls, no preselected citation and no automatic coverage decision.
This allows a fact to cite both its governing wording and its authored limb.
Section 5.1 remains unresolved; one added fact would not establish completeness.
The private browser check selected both passages, expanded the full governing
text, deselected one and cancelled without saving. Revision zero and every
pending decision remain unchanged. Review headings now derive from owned stored
section text rather than the model's long classification explanation; that
explanation remains available separately. Intake party parsing now preserves
comma-containing names and explicit Merger Sub roles. Read-only extraction from
the full saved Olaplex source returns all three exact names; historical source
records are not rewritten. Ben confirmed that a citation should highlight the
exact supporting words and show the surrounding paragraph or clause. The manager
had incorrectly treated the amount of surrounding context as a new legal-policy
decision. No further approval of that design is needed. The local release
evaluator now follows this plan's fixed citation bar: exactness and lawyer-confirmed
legal sufficiency remain required; the previously undefined narrowness checkbox
is diagnostic only. A focused test reproduced the extra rejection before the
correction. Citation, finding-resolution and timing checks now pass, including
rejection of missing or false exactness and legal sufficiency. No real candidate
has been accepted through this correction, and no saved lawyer decision changed.
The source panel now highlights the selected exact words inside the smallest
stored containing clause or paragraph, with the complete source context still
available. Accepted facts, accepted relationships and final citation assessments
now have a separate control for every saved citation, rather than opening only
the first. Focused rendering, source and review-state checks pass. The private
deployment's browser check opened a saved 5.3 citation: its 386 exact source
characters were highlighted within the complete 1,997-character paragraph.
Expanding the wider context exposed all 81 saved passages, including governing
wording, definitions, cross-references and the full section. No byte-mismatch
warning or browser error appeared. Closing the panel left revision zero and all
1,348 pending review items unchanged.
An isolated browser check of the actual summary and evaluation components opened
both citations of a fact and both citations of a relationship. Each control sent
its own saved span and correct source-context identifier; no form submission
occurred. The diagnostic explanation was visible.

The candidate submitted for Arcellx was the private deployment of code commit
`1a932991786972ceee24b1a425e2812dea210a57`, legal-schema revision V1.2 and prompt
bundle `PRODUCT_ROUTING_CITATION_REPAIR/V6`. Its provider is
`OPENAI_CODEX_CLI_SUBSCRIPTION`; routing and residual review use
`gpt-5.4-mini` with low reasoning, and extraction uses `gpt-5.5` with medium
reasoning. The existing worker already carries the V1.2/V6 extraction correction.
The old final-candidate fixture describes the earlier Olaplex test and has no
active product consumer. It is historical evidence, not an extra condition to
start testing. No replacement record or file-hash gate is required. The fixed
release bars below are unchanged. The fixed legal-review rubric still checks
critical or material omissions, citation sufficiency and focus, duplicates,
contradictions, unresolved coverage, required roles, exceptions, final lawyer
acceptance and combined processing/review time. It is not an agreement-specific
inventory. Independent lawyer notes must precede exposure to the AI draft, but
need not precede machine processing.

The untouched Arcellx reserve was submitted through ordinary private intake at
2026-09-06 19:09:17 UTC: run `27dcf3e2-a3cc-45c4-acf6-b4d3973eaf2c`, 83 sections.
The preview database had no prior source for that SEC exhibit. The existing
worker was idle and its V1.2/V6 schema, prompt and model map matched the candidate.
The saved run confirms the intended V6 prompt bundle and call-kind model map.
Two sections started processing. Intake was then closed before completion to
prevent automatic navigation into the AI draft and preserve independent review.
No source or draft output had been inspected at submission. No independent
lawyer inventory or legal acceptance is claimed; Ben's partial Olaplex notes
cannot substitute for an independent inventory of this agreement.
Processing stopped after 19 completed sections, with one failed section and
63 still pending. The remaining in-flight section finished and the remote
worker exited. Two saved extraction calls contain reconnect and transport
fallback errors labelled `content_filter`, followed by `turn.completed`.
Both final-message files are JSON objects and uniquely match the last completed
answer. Only event types, error metadata and these structural checks have been
inspected, not their legal content. Replaying the latest attempt with the old
reader reproduces the failure. The corrected reader permits only the recognised
reconnect and HTTPS-fallback messages before a separately verified final answer.
Unknown errors, failed turns, forbidden tools, incomplete or mismatched output
and invalid usage still fail. Recovery count and types remain in the response
metadata. Direct client, parser and product-adapter checks pass, including a
regression for a forbidden tool hidden on a reconnect event. All four all-family
recorded checks pass, including the real Modiv source-to-Review replay. This
preserves rejection of unsupported or uncited recorded proposals; it is not a
legal acceptance of them. Separate standards and requirements reviews found no
material issues.
The latest saved attempt, selected by its original start time rather than its
legal output, passes the unchanged compiler with three proposals and no compiler
issues. All three requests match the saved requests exactly. This check made no
provider call or database write and did not expose legal content. The correction
is committed as `e53eda1b03e147e080eeefef7d16a8f168be3a9d` and the private
worker's reader matches it. Deterministic recovery through the existing store
then saved the failed section: 20 sections complete and 63 still pending.
The original call records and all 19 prior result rows are unchanged. The three
replayed call records identify their saved source calls and add zero model usage,
cost or duration. No provider call or legal decision was made for that recovery.
The existing hosted worker was then restarted for the remaining sections.
No filtering safeguard, source context, model configuration or release bar has
changed.
This is now an assisted diagnostic, not a passed final test. A new untouched
agreement is still required for the corrected candidate.
Processing finished at 2026-09-06 21:17:14 UTC, with all 83 section results saved
and the draft assembled. The remote worker exited. The draft contains 979
proposals, 139 relationships and 93 findings. All 83 sections have recorded
coverage states, alongside 4,788 role-coverage records; unresolved coverage
remains for explicit review. Opening the private Review page as a development
check created revision zero, with all 1,623 items pending, agreement coverage
unconfirmed, zero review actions and zero publications. Publication is disabled.
The heading initially showed only `Inc.` for each party. The preamble parser
missed the colon after `among` and semicolon party separators. The correction
retains full names for new intake and supplies a display-only repair for old
suffix-only names when the saved source yields an unambiguous, complete list
with matching roles. Historical identity records remain unchanged. The draft
is now exposed for development, not untouched evidence.
The header's zero unresolved count describes reviewer decisions, not the 51
underlying unresolved coverage assertions. All 51 and all 93 findings have pending
review paths; the labels need to make that distinction clear. A source-navigation
check also found that a two-citation proposal opens only its first citation.
The correct increase-price words survive in its second saved citation. The
containing clause also survives, but the panel initially selects a shorter stored
passage ending mid-clause. The correction must expose each saved citation and
prefer an existing complete containing clause, without guessing legal relatedness,
altering saved evidence or making a lawyer decision. Those display corrections
are implemented. The focused identity and Review checks pass, as do the SEC
identity/foundation checks. The citation and context checks pass, including an
isolated real-component browser check. Independent standards and requirements
reviews found no code defect requiring correction. An additional model-coverage
counter was not adopted: the existing pending review paths remain intact, and
the amended labels explicitly describe reviewer decisions. Code commit
`fdcf66359e590c6a4ae196661bd7df1a1de0bdd2` is deployed privately. The real draft
now displays the full Gilead, Ravens Sub and Arcellx names. Both numbered citation
controls open their distinct saved supporting words inside the complete clause
at bytes 9399-11871, with no byte mismatch or browser error. Review remains at
revision zero with agreement coverage pending, no review actions and no
publication. The ordinary unsigned-in route still redirects to sign-in.

The next corrected candidate is private code commit
`fdcf66359e590c6a4ae196661bd7df1a1de0bdd2`, with unchanged V1.2 legal schema,
V6 prompts and call-kind model selection described above. Its next untouched
agreement is Apogee Therapeutics' original merger agreement dated 2026-06-18,
filed as EX-2.1 on 2026-06-22, accession `0001140361-26-025844`:
`https://www.sec.gov/Archives/edgar/data/1974640/000114036126025844/ef20076505_ex2-1.htm`.
The target's own SEC filing identifies its Nasdaq-listed common stock. Current
repository text and Git-history string searches found no Apogee or exact
accession match; the disposable source table had no matching exhibit. Those
checks do not claim absence from every external system. The private worker is
idle and its eight model-path code, schema and configuration files match the
candidate. No new model configuration, source reduction or release bar is
introduced. No draft output has been inspected. Independent lawyer notes must
still precede exposure to the AI draft; legal acceptance is not implied by
starting machine processing.
Normal private intake created run `a21f9bf7-f217-4f20-879c-586bad2e8be2` at
2026-09-06 21:48:04 UTC, with 95 sections. The saved run confirms V6 prompts and
the expected model map. Two sections started processing. The intake page was
closed before completion to prevent automatic opening of the AI draft.

At the 2026-09-06 23:18 UTC checkpoint, Apogee was still processing after 90
minutes, with 79 sections complete, two running, 14 pending and none failed.
No manual retry, code change or model-configuration change had been made during
the run. Processing continues unchanged to preserve the result. Exceeding the
limit before lawyer review means this run cannot satisfy the combined 90-minute
bar. The draft remains unopened; no legal acceptance or phase completion is
claimed. A further agreement will not be started automatically to replace this
timing failure.
Apogee then reached `READY / READY` at 2026-09-06 23:28:21.561513 UTC, with all
95 section results saved and no failed section. Creation-to-ready time is
6,016.770341 seconds, or 100 minutes 16.770341 seconds. The manager's read-only
check confirms the terminal state, saved-result count and zero review sessions
and review actions. The independent status monitor also reports zero
publications. No legal output has been inspected and no lawyer decision is
claimed. This proves ordinary processing completed without a manual repair;
it does not pass the time bar or the outstanding legal-review requirements.

Ben subsequently confirmed on 2026-09-06 that taking more than 90 minutes is
acceptable for this launch and that speed improvements should wait until there
is better evidence about product use. That explicit decision removes only the
elapsed-time launch limit. The observations above preserve the result against
the limit that applied when the run finished; they are not retroactively
reported as a pass. Processing and lawyer-review durations remain measurements.
No legal accuracy, citation, inventory, coverage, exception review, contradiction,
unresolved-state, lawyer-acceptance or ordinary-flow requirement changes.
The same unopened Apogee result remains available for independent legal review;
this timing-policy change alone does not require another extraction run.

Ben then supplied notes on 2.1(a)(i), the Article III introduction, 3.9(b),
5.2(b)(viii), 5.5(b), 5.5(e) and 6.3(a). His latest complete message supersedes
the two interrupted drafts. The notes are preserved privately, separately from
assistant source checks. They precede inspection of the corresponding saved AI
proposals. This is a selected-provision comparison, not a complete independent
critical/material inventory, a severity assessment, or lawyer acceptance.
Source checks identify the Article III filing date as on or after 13 July 2023
and the recipients as Parent and Merger Sub; those corrections are not silently
substituted into Ben's original notes. No new extraction is needed for this
comparison. The unreviewed remainder and all final legal-review requirements
remain outstanding.

The selected-provision comparison preserves the share price and named share
exclusions, both capex thresholds and the introductory exceptions, the
regulatory strategy and consultation duties, and the four representation
bringdown standards with their timing. These are draft comparisons, not lawyer
acceptance. The ordinary-course representation retains its local qualifications
but lacks the Article III disclosure qualifications. The Article III introduction
exists in the saved structure but has no work row, result, proposal, coverage
assertion or issue. No link supplies it to the selected representation or
bringdown proposals. Root confirmed the missing work and coverage directly.
This is a shared coverage failure, not a reviewed omission.
The correction gives article introductions ordinary section processing and
coverage. A section receives its own article introduction as surrounding
context, including that introduction's definitions and explicit references.
The imported text does not become the child section's own operative text;
main-agreement and exhibit scopes remain separate. The saved Apogee structure
contains two introductions, so the corrected selection is 97 sections versus
95 under the old exclusion. The original 95 saved results remain unchanged.
Publication now requires the exact expected section identities in both saved
results and section coverage, including introductions. Missing data and a
wrong-section substitution fail even when counts match. Complete data can
publish, and historical reads remain unchanged. The focused source checks,
full Phase 2 checks with real Concho source, all-family recorded checks with
real Modiv source, and dedicated full-chain database check pass. Root repeated
the affected source checks and database check; two independent code reviews
found no remaining defect. The private database update preserves service-only
access and adds no security warnings. These checks are not lawyer acceptance
or completion of Phase 5. The later testing correction below removes the
automatic fresh-agreement requirement for this mechanical source-preservation
fix. The correction does not provide fresh evidence of unseen legal accuracy.
The capex proposal keeps the individual $250,000 limit in review-visible text
but only the $2,500,000 aggregate limit as a separately searchable numeric value;
that alone does not block internal launch. Section 5.5(b) retains all eight
buyer-side remedy exclusions and the Company's separate prohibition in its
qualifications, but not as a separate Company duty. The share conversion fact
uses Cancelled Shares without a separate definition link, but root verified
that its saved full Section 2.1 context includes the complete adjacent
cancellation definition. Neither observation is an automatic failure merely
because a separate field or fact is absent.

Earlier assembly retries regenerated no sections or model calls. A separate
one-limb IOC probe retained full context and
returned two proposals in 37 seconds, but still missed an inherited verb in one
citation. It is not a full-section result or an accepted processing change.
The original Olaplex run is unchanged. Testing it again is diagnostic work,
not a new blind test. The assisted diagnostic has exceeded 90 minutes before
lawyer review and cannot meet the combined processing/review bar. Full lawyer
review and publication remain unproved. No release bar or production setting has
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

That integrated diagnostic started through the normal private intake on
2026-09-06 as run `9cb8e881-0757-4658-98ef-3f9484421d80`. Automatic retries
exposed a database collision: different proposals with the same family, type
and exact source span received the same fact identifier. Earlier saved replies
compile successfully but could not save together. The run stopped with 14
completed sections, two failed sections and 63 pending. Every completed section
and received model reply remains saved. The correction keeps each colliding
candidate, its statement, roles and citations, assigns a distinct unresolved
candidate identifier, and raises one source-linked finding per shared anchor.
It does not decide whether the candidates express different duties or duplicate
one duty. A lawyer can retain both after explicit review or reject one. The
database uniqueness rule remains unchanged. The inactive database check fails
with the actual duplicate-key error under the prior compiler and succeeds under
the correction. The all-family recorded checks pass; read-only replay retains
all candidates from the actual failed replies. Review now explains the collision
in plain language and preserves the full recorded detail, including malformed
detail. Ordinary Retry resumed the same run and retained the original 14 result
rows. Five subsequent collision findings retain all ten referenced candidates
separately, invalid for automatic use and with their source citations intact.
The browser counter advances without a reload. The new access result has 14
proposals and 16 relationships, including separate access, cooperation and
information duties, four exclusions and the privilege and compliance workarounds.
The no-shop result separates the prohibited and permitted actions and retains
the furnishing-specific confidentiality wording. Its cessation proposals omit
the information-provision parenthetical, and its information-parity fact lacks
a link to the furnishing permission. Missing separately queryable fields do not
by themselves block the internal launch. Section 5.1 saved no proposals after an
extraction timeout and an empty later response; its full source survives and its
coverage remains unresolved. The cause is being investigated from saved calls.
Ben's two original note messages are also preserved privately outside the public
repository. Their transcription is partial, with severity and acceptance pending;
it is not an attestation or a completed independent inventory.

- [x] Run the release candidate on the untouched blind agreement.
- [x] Review the complete NCS draft with Ben. Done 2026-09-12 on the focused
      review page: 13 briefed provisions, 35 comments, 2 edits, 3 unresolved
      marks, recorded verbatim and consolidated. Outcome: rebuild the fact
      model as layered components (Phase 5B below). His Olaplex and Apogee
      samples are reconciled against V2 output, not V1.
- [ ] Reconcile Ben's existing independent, detailed provision samples against
      the corresponding V2 agreement results. A separate full lawyer-written
      inventory is not required. Tooling merged 2026-09-12 23:40 UTC from
      `session_01XujbrYbTFpQC1WWMjAfYEQ`: `lib/product/sample-reconciliation.js`
      and `scripts/product/reconcile-sample-notes.js` match the note items in
      `fixtures/product/ben-samples/` to V2 facts by section reference and
      word overlap and write a Markdown report with severity and acceptance
      columns left for Ben (`tests/product-sample-reconciliation.test.js`).
      Waits on V2 runs of Olaplex and Apogee.
- [ ] Measure severity-weighted reference-sample success, with missed,
      incorrect and unresolved counts, citation sufficiency and narrowness,
      duplicates, contradictions, unresolved burden and review time. Report
      sample precision or recall only where the reviewed comparison supports
      the denominator; otherwise report it as unavailable. Do not infer
      whole-agreement accuracy from the samples.
- [ ] Count `UNRESOLVED` against sample recall where applicable and against
      overall review burden.
- [ ] Fix shared release-blocking failures once. Ben's 2026-09-12 review
      found the shared failure to be the fact model itself; the fix is
      Phase 5B, not a V1 correction.
- [ ] Test the stable final extraction approach on an untouched agreement.
      This now means the V2 approach after Phase 5B. Use known agreements to
      verify mechanical fixes. Require a new untouched agreement after a
      material change to legal extraction decisions, not automatically after
      every code correction.

Testing correction, 2026-09-06: Ben challenged the cost of processing a new
agreement for each fix. The article-introduction defect already had a failing
reproduction, corrected checks on known Concho and Modiv sources, exact saved
Apogee structure replay, and database checks for missing coverage. A further
whole-agreement run was not needed merely to prove that code correction.

For mechanical source preservation, storage, citation-coordinate or display
fixes, run the affected checks in section 9 against known agreements. Confirm
the complete affected product flow where needed. Do not present a reprocessed
known agreement as fresh evidence of unseen legal accuracy. A change that
introduces new legal-relevance judgements, changes the requested legal
distinctions, or tunes extraction decisions using exposed legal results still
needs a new untouched agreement. This includes material prompt, model, schema
or semantic routing changes. Do not describe such a change as mechanical to
avoid independent testing.

Keep one final untouched test for the stable extraction approach. NCS was
already submitted when this testing correction was made and continues as that
test; no further deal is to start solely because of a mechanical fix. No
legal-review or publication requirement below is relaxed, and no checklist
item becomes complete merely because this testing rule changes.

Draft-quality diagnostics:

- severity-weighted success and missed, incorrect and unresolved counts within
  Ben's independently supplied samples only; expected-point notes alone do not
  establish a denominator for precision. Any precision or recall measurement
  must state its supported sample scope, with no whole-agreement extrapolation;
- citation sufficiency and narrowness;
- duplicate and contradiction rate;
- unresolved count; and
- model cost, run time and lawyer review time.

These figures guide later automation. They are not hard release claims from one
blind agreement.

Supervised internal-release bars:

- Ben's independent provision samples are reconciled against their own
  agreements, with misses and corrections recorded honestly; Ben then reviews
  the complete final agreement draft, including facts, exceptions and coverage;
- 100% of published facts have exact and legally sufficient citations;
- 100% of substantive sections and required roles have a coverage state, every
  exception has been reviewed, and the lawyer has given one agreement-level
  coverage confirmation;
- zero contradiction remains inside a published proposition group;
- zero `NOT_RUN` or `UNRESOLVED` item is presented as absence or completion;
- 100% of final published facts are lawyer accepted; and
- a standard agreement can be processed and reviewed through the ordinary
  product flow without a developer.

The original 90-minute processing-and-review limit was removed by Ben's explicit
2026-09-06 decision. Processing and review time remain measured and reported,
but elapsed duration alone does not reject the supervised internal release.
Speed improvement is deferred in section 7. The separate full-inventory
requirement is replaced only by Ben's explicit decision below. All other
publication requirements are unchanged.
Any further weakening needs Ben's explicit decision because it changes what the
product promises.

Lawyer-review correction, 2026-09-07: Ben approved using his existing detailed
Olaplex and Apogee samples instead of requiring a separate complete lawyer-written
inventory before exposing the final draft. Those samples remain tied to their
own sources; they are not an NCS inventory or acceptance of NCS conclusions.
Independent sample comparisons do not measure whole-agreement omissions.
Every final published fact still needs lawyer acceptance, every exception still
needs review, and agreement-level coverage still needs one lawyer confirmation.
The remaining citation, contradiction and unresolved-item requirements above
are unchanged. No publication or production cutover is authorised by this change.

Implementation check, 2026-09-07: the review form now uses reference samples
linked to stored original sources that the signed-in reviewer can access.
Each sample records its section, legal point, severity and explicit found,
missed, incorrect or unresolved assessment. The database independently checks
source access and the reported sample counts. Historical evaluations remain
readable. The affected application checks passed, and a local database check
used the full current rules, including article-introduction coverage, then
restored the previous database behaviour and successfully reapplied the change.
The changed form passed its local browser check. The older broad Phase 3
database fixture still fails before this change because it contains only 101
of 109 substantive Concho sections; it is not reported as passing. The update
was applied only to the disposable private database, with unchanged access
permissions and no new security findings. NCS still has 104 saved sections,
one review session, no review actions and no publication. These checks do not
complete Ben's legal review or the Phase 5 exit condition.

Ben's review cadence, 2026-09-07: show him a full agreement now, starting with
the completed NCS draft, before processing any more agreements. Run focused,
source-linked excerpts by him during development rather than saving all feedback
for a final whole-agreement review. He must review no later than four to five
total distinct agreements; use four as the planning limit and earlier when a
complete useful draft is ready. Prior agreements count, and reruns or phase
changes do not reset the count. Several agreements have already been processed,
so review is due now. Do not expand to ten or forty agreements ahead of his
review. This changes work order within Phase 5, not the Phase 0 to 6 sequence,
and does not create a separate gate or status document.

Exit: the final candidate satisfies every supervised internal-release bar.
Its stable legal extraction approach has an untouched agreement test; material
changes to legal extraction decisions require a new untouched test as above.
Mechanical corrections have the affected product checks on known agreements,
and every final published fact, exception and coverage decision has the
required lawyer review. Exposed reruns are not claimed as unseen legal proof.

### Phase 5B. Rebuild the fact model as layered components, 6 to 8 days

Decision, 2026-09-12 (Ben): rebuild rather than patch. The one-sentence fact
with a flat bag of forced roles is the wrong unit. A fact becomes a headline
plus an ordered tree of verbatim components, each comparable across deals at
its own layer. The published page leads with the headline layer only; the
current one-sentence facts disappear from it. Each layer is reachable by a
visible click from the layer above.

Headline rule: the headline carries whatever distinguishes the provision
from its counterpart in another deal, not just its topic. For a Material
Contracts category that is topic plus threshold plus carve-out; for an MAE
carve-out it is the carve-out subject; for a termination right it is the
trigger and the terminating party. The headline is a controlled label; every
layer beneath it is the agreement's words, marked as inherited from the
chapeau or the limb's own.

What the rebuild changes, from Ben's 2026-09-12 review (see
`docs/codex-program/notes/NCS-REVIEW-IMPLICATIONS-2026-09-12.md`):

- Component tree per fact with verbatim quotes, byte spans and inheritance
  markers. Litanies are one component with member words, not one fact per
  synonym. Lists that vary between deals (carve-out elements, contract
  categories, remedy actions, notice contents, fee triggers, tail parts,
  divestiture actions) are one component per element.
- Roles: timing and qualification optional; forum added; an empty role is
  allowed and the prompt no longer forbids it. Actor and object checked
  against the sentence's grammatical subject and object.
- Covenants carry an efforts standard and a materiality qualifier as
  components.
- Bring-downs: one structure per tier naming the covered reps in words, the
  standard as the key component, "remaining" computed as the complement.
- Cross-references resolve to the referenced content (conditions in
  termination rights, reps in bring-downs, defined terms such as Acceptable
  Confidentiality Agreement, fee amount on the trigger).
- Subtypes renamed and added per Ben's names: return or destroy
  requirement; subsequent VDR removal; efforts standard; restriction on
  proposing or agreeing to remedies; obligation to litigate; agreement of
  irreparable damage; agreement to equitable relief; delivery of written
  consent; delivery of support agreement; date-based bespoke termination
  right; tax opinion qualifier; construction rule categories.
- Thresholds, periods and percentages are components with canonical values.
- Consent-deal mechanics tracked, including Consenting Stockholder identity
  or percentage.
- Boilerplate families are coverage-only: categorised for later comparison,
  not shown to the reader.

Sequence and proof:

- [x] 5B.1 Component contract. `contracts/product/fact-components.v2.json`
      defines the tree shape, inheritance markers, headline rule and the
      validation rules; `lib/product/fact-components.js` validates a fact
      against it and renders layers. Proof passed 2026-09-12:
      `node --test tests/product-fact-components-contract.test.js`.
- [x] 5B.2 Legal schema V2. Draft written 2026-09-12:
      `contracts/product/legal-schema.v2.json`, generated deterministically by
      `scripts/product/build-legal-schema-v2.js` from V1 plus an overlay
      carrying Ben's subtype names, per-family headline and layer rules,
      optional timing, qualification and forum, covenant standard components,
      the BREACH role fix, consent-deal subtypes, FEE_ELECTION,
      ACCEPTABLE_CONFIDENTIALITY_AGREEMENT and coverage-only boilerplate.
      25 families, 194 subtypes (179 in V1). The loader validates both
      versions. Proof passed: `tests/product-legal-schema-v2.test.js`.
      Status DRAFT_FOR_BEN_REVIEW: Ben sees the headline and layer rules for
      the families he reviewed before prompt V7 uses them; the extraction
      still runs on V1 until 5B.3 lands.
- [x] 5B.3 Extraction prompt V7 and storage. Extraction half done
      2026-09-12: when the legal schema is V2, `agreement-draft.js` sends
      prompt `PRODUCT_ALL_FAMILY_EXTRACTOR/V7` with a component instruction
      and the family layer rules, drops the forced-role sentence, compiles
      each proposal's component tree to byte-checked spans, parses canonical
      values in code, derives the headline, and holds a proposal as INVALID
      with an `INVALID_FACT_COMPONENTS` or `INVENTED_ROLE_TEXT` issue rather
      than dropping it. V1 runs are byte-for-byte unchanged. Proof passed:
      `tests/product-fact-components-extraction.test.js` plus the Phase 2,
      Phase 4, recovery, link-retention, collision and role-key suites
      (58 tests). Storage half merged 2026-09-12 from the 5B.3 worker:
      `product_fact_components` and `product_fact_headlines` tables, written
      in the same atomic section commit by an additive wrap of the commit
      RPC, validated before write, rebuilt as a tree on the Review read path,
      V1 runs untouched (`tests/product-fact-components-store.test.js`).
      Migration applied to the private preview database 2026-09-12
      (tables present, commit RPC wrapped; V1 commits unaffected). Schema
      selection added: every entry point (web run, hosted worker, local run,
      review handler, workspace) follows the run's own recorded schema
      version, and new submissions use V1 until
      `NEXT_PUBLIC_PRODUCT_LEGAL_SCHEMA_VERSION=LEGAL_SCHEMA/V2` is set on the
      private preview (`lib/product/legal-schema-selection.js`). Remaining:
      recorded-fixture replay under V7 once a V2 run has saved calls. Done
      2026-09-12 23:40 UTC under V8: `tests/product-v8-replay.test.js`
      replays a real generation 4 extraction call
      (`tests/fixtures/product/ncs-v8-extraction-call.v1.json`) through
      `compileExtraction` (merged from `session_01NoHhHYd1HWTi2qsXK2wb1N`).
- [x] 5B.5 Published reader view on layers, built first. Component merged
      2026-09-12 from the 5B.5 worker: `components/product/PublishedSummary.jsx`
      and `lib/product/published-layers.js` render headline first, click to
      descend, inherited words marked, values beside thresholds, references
      on hover, coverage-only facts hidden, against
      `tests/fixtures/product/published-layers-fixture.v2.json`
      (`tests/product-published-layers.test.js`). Wiring merged 2026-09-12
      21:25 UTC from `session_016AqiuEnkiKWJRp5rJnZXcj`: `compileReviewSummary`
      carries components, headline, coverage_only and section_reference on a
      summary fact with a V2 tree; `AcceptedSummary` renders those through
      `PublishedSummary` under the run's schema and keeps V1 facts under
      "Facts without layers". Remaining: one browser check on a V2 run
      (blocked on 5B.6).
- [x] 5B.4 Review page is the production page plus aids (Ben, 2026-09-12:
      "the next review page I see to be the final production style page just
      with additional things added to aid review"). The focused page renders
      facts exactly as `PublishedSummary` does and adds, per fact, the
      decision buttons, comment, revert, held content, the brief's "look for"
      line and click-to-highlight of cited words in the provision text. No
      second renderer. Depends on 5B.5. Files: `components/product/FocusedReview.jsx`,
      `lib/product/review-state.js` for component-level edits. Proof: display
      tests and one browser check. Display work merged 2026-09-12 21:25 UTC
      from `session_01MapHS8xt3cyBdxGNn6RcfU`: a proposal with a V2 tree
      renders through `PublishedFact` with the decision buttons, comment and
      revert passed in as aids; clicking a component highlights its bytes in
      the provision text, clicking the headline highlights all own
      components; proposals without a tree are unchanged. Component-level
      edits merged 2026-09-12 22:10 UTC from `session_01HTmc6MH7SNADn1bujttuFp`:
      `DECIDE_ITEM` EDITED carries a validated component tree and headline
      (`edited_components`, `edited_headline`, cleared by reset, preferred
      by the summary); the editor in `FocusedReview.jsx` recomputes UTF-8
      byte offsets from the section text (`lib/product/component-edit.js`)
      and blocks text that is missing or not unique. Lead fix on merge: the
      database requires an edited proposal to carry statement and roles, so
      the payload keeps them. Remaining: the browser check on a V2 run (5B.6).
- [x] 5B.2a Ben's check of the V2 headline and layer rules, 2026-09-12:
      `V2-HEADLINE-AND-LAYER-RULES-FOR-BEN-2026-09-12.md` put seven
      questions; Ben answered all seven (Q6: every MAE carve-out is its own
      visible fact). Rules changed in the generator and schema regenerated:
      termination headline carries the cure right and conditions or
      exceptions; fee headline is amount, payer, trigger, deeming named on a
      tail; consent facts carry no cross-references to termination, conditions
      or fees; the "other reps" bring-down tier keeps the words of the text
      and carries one resolved cross-reference per representation for the rep
      table; antitrust shows every obligation; boilerplate is a collapsed
      section on the published page (`lib/product/published-layers.js`,
      `PublishedSummary.jsx`).
- [x] 5B.6 Rerun NCS under V2 as a new generation. Needs two things from
      Ben's side. (1) Update the hosted worker's checkout: from a machine
      logged in to Vercel and linked to the deal-corpus project, run
      `node scripts/product/update-sandbox-worker.js` in the repository; it
      resumes the persistent sandbox, fetches and checks out the product
      branch, reinstalls dependencies and prints the commit. (2) Set
      `NEXT_PUBLIC_PRODUCT_LEGAL_SCHEMA_VERSION=LEGAL_SCHEMA/V2` for the
      preview environment of the product branch
      (`vercel env add NEXT_PUBLIC_PRODUCT_LEGAL_SCHEMA_VERSION preview codex/product-implementation-plan-20260904`,
      then a push or redeploy so the intake form picks it up), then resubmit
      the NCS URL through the normal intake. 2026-09-12 21:19 UTC: Ben's
      first resubmission deduplicated to the V1 run because the browser
      bundle had been built without the variable; commit `95f9171` makes the
      intake handler select the schema server-side, so the variable only has
      to be present in the deployment's preview environment. 22:15 UTC:
      the variable reached the server after Ben relinked his Vercel CLI to
      deal-corpus and redeployed; run `19927583-8bf8-4f9e-8607-16cbabda2c57`
      was created as generation 2 under V2 and prompt bundle V7, then
      FAILED on its first routing calls: the re-created sandbox carries Codex
      CLI 0.145.0, which rejects gpt-5.4-mini on a ChatGPT login. Probe
      (`scripts/product/probe-sandbox-models.js`, Ben's output 22:25 UTC):
      only gpt-5.5 is accepted. Routing and residual calls moved to gpt-5.5
      at low reasoning effort (`lib/product/product-model-config.js`); the
      changed model configuration means the next submission is generation 3.
      Sequence: Ben runs `update-sandbox-worker.js`, then resubmits.
      22:24 UTC: generation 3 `a7fb5881-dd93-43b6-96f3-888d083acda9` running
      on gpt-5.5 under bundle V7. First 23 proposals: 4 valid, the rest held
      by the component validator for (a) kinds outside the contract (PARTY,
      SUBJECT, LEGAL_STATUS, TIME, QUALIFICATION, and the V1 role names used
      as kinds), (b) descriptive PERIOD or DATE words with no number ("on the
      second Business Day following ..."), (c) one non-contiguous quote.
      Fixes 22:40 UTC: the extraction prompt now lists the closed kind set
      and says role names are not kinds (`PRODUCT_ALL_FAMILY_EXTRACTOR/V8`,
      bundle `PRODUCT_LAYERED_COMPONENTS/V8`); unambiguous synonym kinds map
      to the contract kind in code; contract rule R6 lets PERIOD and DATE
      carry value null when the words hold no number. Held proposals keep
      their components in the payload, so generation 3 stays useful as prompt
      evidence. Next: sandbox update, resubmit as generation 4 under V8.
      22:38 UTC: generation 4 `39456f2d-4c92-46c9-8398-2d55c5b0a58f` under
      V8 on sandbox commit eab61a5; generation 3 stopped by hand so the
      per-account worker lock freed (`scripts/product/sandbox-exec.js`).
      22:57 UTC, 8 sections in: 36 of 43 proposals valid (generation 3 at
      the same point: 4 of 23). Remaining holds: THRESHOLD used for a
      comparative without a number or for a period, and non-contiguous
      quotes. Code-only follow-up pushed (THRESHOLD may be descriptive;
      a period-shaped threshold parses as a period); it applies from the
      next sandbox update, not to the run in progress, so generation 4's
      held items stay as recorded. 2026-09-13 00:40 UTC: generation 4
      FAILED at 30 of 104 sections when section 3.12's extraction hit the
      10-minute Codex timeout on all three attempts (a comparable section
      finished in 9.6 minutes with 31,843 output tokens); 287 of 320
      proposals valid so far, 3.1 and 3.16 complete. Fix: extraction calls
      get a 30-minute timeout in `lib/product/codex-cli-model.js` (the
      run's model configuration is unchanged, so the same run can be
      retried). Sequence: Ben updates the sandbox and presses "Retry failed
      sections" on the intake page, which resets the failed section and
      resumes the 73 pending ones in the same generation. Ben retried
      2026-09-13 00:53 UTC after the sandbox update; 3.12 completed on its
      second attempt in 633 seconds, past the old limit, so the 30-minute
      timeout is confirmed live. 01:30 UTC: 49 of 104 sections, 406 of 479
      proposals valid. 03:20 UTC: all 104 sections complete, 850 of 995
      proposals valid, 5,070 components, every briefed section in; draft
      finalisation then FAILED with DRAFT_NESTED_IDENTITY because the Review
      read path attaches `coverage_only` to each proposal and the identity
      re-check hashed it in (reproduced from the stored proposal in
      `tests/product-proposal-identity.test.js`). Fix: finalisation ignores
      the read-side annotations `coverage_only` and `conclusions`
      (`PROPOSAL_READ_ANNOTATIONS` in `lib/product/agreement-draft.js`).
      The conclusions migration `20260913020000_product_fact_conclusions.sql`
      was applied to the preview database at 03:30 UTC after the sections
      finished (table and wrapped commit function verified). Sequence: Ben
      pulls, runs `update-sandbox-worker.js`, presses "Retry draft assembly"
      on the intake page; the sections are not re-run. 2026-09-13 11:54 UTC:
      a stale browser tab carrying `?productRun=a7fb5881…` auto-advanced the
      abandoned generation 3 (V7), which held the per-account sandbox lock;
      the 11:56 retry queued behind it and expired at 12:56. Generation 3
      was killed at 15:00 UTC after 91 sections; the 15:01 reload woke
      generation 4, whose finalisation FAILED again with
      DRAFT_NESTED_IDENTITY on a second proposal (3e9c4da8…, section 1.1
      "Tolling Period"): the store's component-row rebuild dropped
      `value: null` on a PERIOD component, so the rebuilt tree no longer
      hashed to the stored proposal id. Fix: the rebuild mirrors the writer's
      key rules (value kinds always carry `value`, reference kinds
      `resolves_to`, litanies `members`, inherited components
      `origin_structure_node_id`, each nullable); regression from the stored
      rows in `tests/product-proposal-identity.test.js`. 15:12 UTC retry:
      FAILED again on the first held proposal (324dbed6…, section 1.1
      bylaws succession): the read path stripped `components` and
      `headline` from every proposal without component rows, but a held V2
      proposal keeps its rejected tree in the stored payload and its id was
      hashed over it. Fix: proposals without rows read back exactly as
      written. All 995 stored proposals were then re-hashed locally through
      the fixed read path (101 mismatches before, 0 after). 15:19 UTC:
      generation 4 READY, draft 0c7c41a1…; 104 sections, 995 proposals
      (850 valid), 5,070 components, no coverage-only headlines. This is
      the V2 baseline for Ben's re-review of the 13 briefed provisions and
      for the V1-to-V2 comparison. The submission creates a V2
      generation with prompt bundle `PRODUCT_LAYERED_COMPONENTS/V7`; the V1
      run and revision 45 of its review stay untouched as the baseline. Compare against Ben's 38
      touched items and his samples. Ben reviews the same 13 provisions again
      on the layered page. Comparison tooling merged 2026-09-12 from the 5B.6
      worker: `lib/product/review-comparison.js` and
      `scripts/product/compare-review-items.js` map V1 review items to V2
      facts by node and byte overlap and write a Markdown report
      (`tests/product-review-comparison.test.js`). Input export merged
      2026-09-12 22:40 UTC from `session_01VkE1xTDyLhQiFa7kUQLq32`:
      `scripts/product/export-review-comparison-inputs.js` reads the V1
      review state and the V2 analysis through the same store reads the page
      uses and writes the two comparison files
      (`tests/product-export-review-comparison.test.js`).
- [x] 5B.8 Table shapes and coded conclusions on top of the layered facts.
      Ben, 2026-09-12 23:20 to 23:40 UTC, on the Query mockups (comments
      note sections 7 and 8): the published and Query pages show each
      provision as the current review page does, small tables of headline
      conclusions as pills per subject with a fixed table shape per section
      and a coded vocabulary per column; the verbatim layered facts are the
      evidence beneath, opened from any pill (words, location, layers, checks
      the code ran, review trail, provenance). "yes the target is good. And
      you should do this for all sections." Steps: (a) harvest the table
      shapes and vocabularies from `components/review/table-configs/` into
      `contracts/product/table-shapes.v1.json` with a note for Ben to
      correct (`session_01HJJZ9Z1c9wPtjq8mHNoh6K`); (a2) Ben, 23:50 UTC:
      "feel free to add to the vocabulary / table structure as you have more
      information than the old system had": a second pass proposes
      additional columns and codes from the V2 schema and from the layered
      NCS output, marked as additions in the same note for Ben to accept or
      strike. Pass 1 merged 2026-09-13 00:08 UTC from
      `session_01HJJZ9Z1c9wPtjq8mHNoh6K`: 30 sections, 36 tables, headers
      right, but most columns came out verbatim with no vocabulary because
      the legacy code composes pills in render functions. Ben's printed
      TopBuild review page (`docs/codex-program/notes/TopBuild-Review-2026-09-12.pdf`,
      text in `fixtures/product/topbuild-review/print-text.v1.json`) carries
      the pills as shown; pass 2 (`session_01JddnH4Qh57hJE4kCccU58D`) harvests
      the vocabularies from it and the unread label maps, adds the V2
      additions, and rewrites the note for Ben. Pass 2 merged 2026-09-13
      00:50 UTC: 31 sections, 51 tables, 108 columns, 175 vocabulary
      entries (130 from the print, 27 from legacy label maps, 6 both), 7
      added columns, each column mapped to the component kinds that fill
      it (`contracts/product/table-shapes.v2.json`,
      `tests/product-table-shapes.test.js`). Votes and Employee benefits
      spot-checked against the print pages. Ben answered all twenty of the
      note's questions 2026-09-13 01:00 to 01:10 UTC (comments note section
      10; decisions listed at the end of the table-shapes note): double
      merger and merger-form vocabulary, CVR earn-in, one shared bring-down
      vocabulary, relative lookback, per-row trigger sets, separate no-shop
      verbs, cure and terminator-bar columns, payer column, defined terms as
      an appendix, the four thin sections kept. Pass 3 merged 2026-09-13
      01:35 UTC from `session_01K8KAWSpPXEge1PNjHgTSAg`:
      `contracts/product/table-shapes.v3.json` with shared vocabularies
      (MERGER_FORM, BRING_DOWN_STANDARD), double-merger structure per step,
      cure and terminator-bar columns, payer column, per-row trigger sets,
      defined terms as a reference appendix; 36 tests. Step (a) is done.
      Started 2026-09-13 01:32 UTC in parallel: (b) and (c) in
      `session_01LwCkHrYnHFSMjoDNT9Hsq9` (conclusions contract, validator,
      extractor V9, storage migration not yet applied), (d) in
      `session_01AoH15krAhB3GFZ1tfbu2oe` (table view, ProvisionTables,
      EvidenceSidebar, wired into PublishedSummary, Query provisions page and
      FocusedReview). Both merged 2026-09-13 02:20 UTC: contract
      `contracts/product/fact-conclusions.v1.json`, `lib/product/fact-conclusions.js`,
      extractor V9 (`PRODUCT_LAYERED_COMPONENTS/V9`, V8 kept selectable),
      migration `20260913020000_product_fact_conclusions.sql` (not yet
      applied; applied to the preview database after generation 4 finishes,
      so the commit function is not replaced mid-run), `lib/product/table-view.js`,
      `components/product/ProvisionTables.jsx`, `components/product/EvidenceSidebar.jsx`.
      Lead fix on merge: the table view renders the contract's cell array
      through the conclusions module and accepts an already rendered cell
      object. 105 tests across the affected suites, build passes. (b)
      contract: each fact carries
      `conclusions`, one coded value per column of its subtype's table,
      validated against the vocabulary, alongside the verbatim components;
      (c) extractor V9 returns conclusions; (d) published page and Query
      render the tables from conclusions with the evidence drawer from
      components; (e) NCS regeneration under V9 after Ben corrects the
      vocabularies. The layered-fact contract is unchanged; conclusions are
      an additional layer, so generation 4 stays valid evidence.
- [x] 5B.7 Metsera under V2, then the Phase 5 exit. Ben, 2026-09-12 23:05
      UTC, on the proposal of a fresh untouched agreement: "I really don't
      think we need to do that - we can just re-do metsera". Recorded as his
      decision. The plan's rule (a material prompt, model or schema change
      needs a new untouched agreement) is not met by Metsera, which was a
      Stage 2Y comparator (`evidence/canonical-v2/metsera-*`), so the V2
      Metsera result is an exposed check, not blind evidence; the plan says
      so where it is reported. Metsera source:
      `https://www.sec.gov/Archives/edgar/data/2040807/000119312525210030/d921605dex21.htm`,
      to be submitted through the ordinary intake after NCS generation 4
      finishes (the sandbox runs one agreement at a time). Olaplex
      (`https://www.sec.gov/Archives/edgar/data/1868726/000119312526126362/d119132dex21.htm`,
      V1 runs 068d9468 and 9cb8e881) and Apogee
      (`https://www.sec.gov/Archives/edgar/data/1974640/000114036126025844/ef20076505_ex2-1.htm`,
      V1 run a21f9bf7) follow, so Ben's sample notes can be reconciled
      against V2 output. Ben's notes are stored as supplied in
      `fixtures/product/ben-samples/`; the reconciliation tool is being
      built in `session_01XujbrYbTFpQC1WWMjAfYEQ`.
      2026-09-13 15:47 UTC: Metsera submitted, run c4c90c61… (V2, bundle
      V9, 85 sections). Its first sections went out with the V8 extractor
      prompt and no conclusions: the section runner never passed the table
      shapes through, so the V9 request augmentation never triggered
      outside the unit test. Fix: `lib/product/analysis-runner.js`
      `tableShapesForRun` hands the shapes to every section of a run whose
      recorded bundle is V9 (runner-level regression in
      `tests/product-runner-prompt-bundle.test.js`). Because the fix
      changes no fingerprint input, resubmitting resumes the same run; the
      intake page now accepts `?generation=1` to start a fresh generation
      of the same submission. Recommendation to Ben: kill c4c90c61 and
      resubmit as generation 1 so every section carries conclusions.
      16:20 UTC: generation 1, run d1f37a50…, V9 prompts confirmed and
      conclusions written from the first section. First readout of the
      holds: 5 of the first 15 proposals held with
      INVALID_FACT_CONCLUSIONS, all from two mechanical rules: the
      per-column `fill_from` kinds were single-kind guesses (closing
      timing allowed only OPERATION, so a TRIGGER citation held the fact),
      and C4 rejected a phrase cut from a longer cited component. Contract
      `fact-conclusions.v1.json` C4 now accepts a contiguous run of whole
      words from one cited component, and C6 makes `fill_from` advisory
      (a cited component must belong to the fact; its kind is not
      checked). fill_from still drives the no-conclusions fallback
      rendering. Ben, 2026-09-13 16:30 UTC: "I'd keep the fact and drop
      readout with a note". Encoded: any conclusions problem drops the
      readout and records a CONCLUSIONS_DROPPED note; the fact stays VALID
      (contract C2, compiler and store). Found while encoding it: a
      proposal's conclusions are compiled into it before its id is hashed,
      yet finalisation stripped `conclusions` as a read-side annotation, so
      every V9 fact with a readout would have failed DRAFT_NESTED_IDENTITY
      at assembly. `PROPOSAL_READ_ANNOTATIONS` is now `coverage_only`
      alone and the read path returns a payload's conclusions untouched
      (regression from Metsera proposal f5d41547… in
      `tests/product-proposal-identity.test.js`).

Parallel plan while Ben is away: 5B.1 and 5B.2 are lead work in this
session. 5B.3 storage and 5B.5 reader view run as separate visible sessions
against fixtures built from the contract, with no overlapping files. 5B.4
starts when 5B.5 lands, so the review page and the production page share one
renderer. Prompt V7 waits for 5B.2. Worker sessions started 2026-09-12 20:30
UTC: 5B.3 `session_01TcSpkRunUNCnKiVMntUZRC`, 5B.5 `session_01XN3SV7RNQ5auN72cmE4Fzx`;
the first 5B.4 session was archived unstarted when Ben set the
production-page rule.

### Parallel track, 2026-09-12: Query on layered facts

Ben, 2026-09-12 23:10 UTC: "Can we work any of the query files? Or even just
the UI elements for those / the site generally? FYI Deal storylines is
adjusting the overall site design to be more aligned"; the design is still
being developed and will be sent when done. Started as a parallel track that
does not gate the Phase 5 exit or Phase 6: a Query surface that reads the
contract the released Review writes (accepted, published layered facts across
agreements, by family and subtype, headline first, click to descend), built
in the existing product chrome and restyled when the Deal Storylines design
arrives. The legacy Query, Compare and What's-market pages stay on their
existing path untouched. First worker: `session_01AcnvBt4no15zzgKA5z6t7v` (Q1 and Q2).

- [x] Q1 Store read and API for published layered facts across agreements
      (`listPublishedLayeredFacts` in `lib/product/phase-3-store.js`,
      `pages/api/product/published-facts.js`). Merged 2026-09-12 23:40 UTC
      from `session_01AcnvBt4no15zzgKA5z6t7v`.
- [x] Q2 `pages/query/provisions.js`: family and subtype selects from the V2
      schema, one block per agreement, facts through `PublishedFact`. Merged
      with Q1; superseded in shape by 5B.8 (pill tables per subtype with the
      evidence sidebar), which replaces this page's body once conclusions
      exist. Mockup with Ben's direction:
      https://claude.ai/code/artifact/0caadcfa-a143-4e63-aff3-630a386cacb4
- [x] Q2a Lawyer preview per run, 2026-09-13: `pages/review/product/[id]/provisions.js`
      shows one run's draft in the table layout, read-only, every valid
      layered fact with the evidence sidebar; linked from the review page
      header. Under V8 output (NCS generation 4) the cells are filled from
      component labels and text, which reads roughly; the coded vocabularies
      arrive with the first V9 run (Metsera). Ben, 2026-09-13 17:05 UTC:
      "can we populating the output as it goes?" Done: the page reads
      `/api/product/analysis/:id/preview` (every completed section, the
      saved review applied when one exists) and polls once a minute while
      the run is analysing.
      17:30 UTC, Ben on the first Metsera V9 tables: "this doesn't look
      great...we designed something that was a bespoke grid here not this
      weird table?" Two causes. (1) A render seam: contract-shaped
      conclusions cells were passed through unmapped, so every coded cell
      came out as a blank pill; the table view now maps codes to vocabulary
      labels, values to formatted numbers and text to words, each cell
      keeping its component ids (regression from a real Metsera fact).
      (2) The structure-mechanics table was `one per subject`, which made a
      row per fact ("Merger Sub", "the Company", ...) under ten columns; the
      legacy page is a TERM / PROVISION grid for the deal. The shape is now
      `one per agreement` with `layout: attribute grid` (generator decision
      16), every structure fact filling one row, rendered one line per
      attribute with "See provision" listing the facts behind it.
      Feedback as the run went (Ben, 2026-09-13 17:40 to 18:00 UTC), each
      encoded without a rerun: (a) "cash election - (i) there is no cash
      election and (ii) you missed the CVR portion of the consideration":
      the consideration tables were harvested from an election deal;
      replaced by a deal-agnostic set (generator decision 18: structure
      grid, one row per limb, exchange mechanics, election mechanics kept
      for election deals only); the CVR limb had been held because
      "one (1) CVR" parsed as no value, and AMOUNT now parses a counted
      instrument as a COUNT. (b) "there is no answer on deal structure and
      merger form (step 2) shows - and it shouldn't there is no step 2":
      the structure table now carries guidance on coding dealStructure and
      mergerFormStep1 from the "with and into" words, and the attribute
      grid shows step-2 lines only when the deal is coded DOUBLE_MERGER.
      (c) a closing-timing sentence from 1.02 landed in the conditions
      table as "Antitrust / Regulatory Clearance": the extractor is now
      told to omit conclusions when no fixed row fits rather than pick
      the nearest, and the CLOSING_CONDITIONS layer rule says the closing
      clause's reference to satisfaction or waiver of the Article VII
      conditions is closing timing, never a condition fact (schema
      regenerated). Shape and rendering fixes apply to the running
      generation 2 as it fills in; the extractor-side fixes (consideration
      tables, guidance, the conditions rule, the count parser) need a
      generation 3 once Ben's feedback on generation 2 is in.
      18:05 UTC, second batch, each a rule that applies to every agreement
      (Ben: "remember we want everything to be driven by coding and not
      just a layer on top so all edits need to be repeatable across
      corpus"): (d) "you imagine election mechanics - there are no such
      mechanics, these are payment mechanics that do not need to be
      summarized": exchange and payment mechanics keep no table and no
      readout (section `no_conclusions_subtype_keys`, sent to the
      extractor); the election table is for election deals only. (e)
      "you say no CVR entitlement but your basis for that is out of the
      money options ... but you apply it to all options": the equity
      table's guidance makes a differently treated class its own row, and
      the table view keeps both readings when two facts disagree in one
      cell instead of the first winning (generator decision 19). (f) "you
      are seeing IOCs from Section 2.03 that is the employee comp section,
      not the IOC section": INTERIM_OPERATING layer rule confines interim
      covenants to the conduct-of-business covenant; equity award actions
      are CONSIDERATION / EQUITY_AWARD facts (schema regenerated). (g)
      Representations: "(i) a bringdown standard is what is said in the
      conditions, not the rep ... (ii) the summaries on the left are (x)
      not the right vocabulary - see the precedent and (y) ... a sub item
      underneath a more general organization rep that has sub items
      (which use the same columns) and then the general organization rep
      gives an overview": generator decision 20 makes both rep tables
      fixed lists of the precedent's twenty rep names (open to a new name
      when none fits), adds `row_detail` to the conclusions contract for a
      limb as a sub-item rendered under its rep with the rep's line as the
      overview, and marks the bring-down column `derived`: the page fills
      it from the CLOSING_CONDITIONS bring-down fact whose CROSS_REFERENCE
      resolves to the rep's section, never from the rep (the extractor no
      longer sees that column).
      18:07 UTC: generation 2 FAILED at its 24th section: the first
      CONCLUSIONS_DROPPED note hit the Phase 2 check constraint on issue
      kinds (EXTRACTION, VALIDATION, COVERAGE). Migration
      `20260913180000_product_issues_note_kind.sql` adds NOTE; applied to
      the preview database 18:10 UTC. "Retry failed sections" resumes the
      run; the 23 completed sections stay.
      18:20 UTC, Ben on 3.25 (Anti-Corruption): "why does the full layer
      tree for 3.25 stop with [the look-back, the knowledge qualifier and
      the Representative actor]? Why doesn't it go onto what the rep is
      actually about? Also it isn't a status rep". The extractor had made
      the knowledge qualifier a fact of its own (the one Ben opened) and
      labelled limb (iii) a status representation; limbs (i) and (ii)
      were extracted correctly as compliance facts and (iv) was held on a
      non-contiguous quote. REPRESENTATIONS layer rule: a qualifier is
      never a fact of its own; a limb's tree runs from qualifiers through
      subject to operation and object; the subtype follows the heading's
      topic, never a limb's grammar (schema regenerated). The evidence
      sidebar is now sticky (Ben: "the top of the side bar should be
      where I'm looking").
      19:00 UTC, Ben on the general covenants table (access covenant as a
      row per grammatical subject with its verbs in two columns): "this
      is the access covenant....". The legacy Other Covenants was a link
      index, nothing to harvest; generator decision 21 makes the table
      one row per covenant (V2 subtypes plus the covenants the legacy
      index curated, open to a new name) with obligor, standard, scope
      and exceptions, limbs as sub-items.
      19:10 UTC, Ben on employee benefits: "this is also garbage - look at
      the precedent - we should be showing rows for each type of
      instrument vs standard and period and then for things that don't
      fit that rubric a simple 2 column table". Three causes, all rules
      now: (1) a fact whose readout was dropped fell back into the table
      as a row keyed by its grammatical subject with components as pills;
      no fact without a readout becomes a row any more, it is listed under
      the section as evidence without a readout, openable in the sidebar
      (this also retires the V8 fallback rendering). (2) Most readouts
      had been dropped by two over-strict checks: a period cited from a
      TRIGGER component now parses as the column's value kind (C3), and a
      verbatim run may span adjacent cited components read in order (C4).
      (3) The benefits table keeps the precedent's rows per benefit
      element (open to a new element) with guidance and an
      EMPLOYEE_MATTERS layer rule that a covenant listing several elements
      yields one fact per element; the other-protections table becomes a
      two-column Term / Provision table (generator decision 22).
      19:20 UTC, Ben: "you have a termination right under approvals. And
      then the votes section looks awful. And then so does the meeting
      section...just doesn't make sense". The legacy Approvals / Votes
      section mapped to TERMINATION (harvest artefact) and the SEC-meeting
      section had no printed shape; generator decision 23 removes both,
      keeps the print's votes table (p.114) as the one votes table with
      the period's anchor and a detail column added, and adds a
      two-column Proxy statement & SEC table for the proxy and SEC facts.
      19:30 to 19:45 UTC: general covenant rows now derive from the fact's
      subtype (Ben: "the covenant column needs to give a description of
      the type of covenant"); sections collapse with collapse / expand
      all; on the buyer's conditions ("(i) the titles of the reps, not
      their x-refs should be included, (ii) where is cov compliance,
      (iii) the Materiality Qualifiers Disregarded should be shown per
      row of reps and we should put row lines in there to clearly
      separate") generator decision 24 adds a Performance of Covenants
      row to both conditions tables, shows the reference column as the
      resolved representation titles, and makes each bring-down tier its
      own line under Accuracy of Representations with the row's line as
      the overview.
      19:50 UTC, Ben on the MAE section: "if there is no MAE for parent
      just say none. And in the carve outs column we need to use generic
      titles. And the disproportionate carve out must say yes or no. Then
      we should show how the disproportionate carve out is drafted at the
      bottom of the table". Generator decision 25: the definitions table
      renders "None" for a fixed party row no fact fills (once another
      row is filled); the carve-out tables are fixed lists of the corpus
      taxonomy's generic carve-out titles, open to a new one, with the
      carve-out's words beside the title; the carve-back column is Yes /
      No and a blank reads No; the disproportionality carve-back fact is
      the table's footer, as drafted, never a row. Rendering applies to
      generation 2; the generic titles and the footer routing reach the
      extractor with generation 3.
      19:45 UTC: generation 2 READY, 85 of 85 sections, 422 valid facts,
      305 with a readout, 47 readouts dropped with a note.
      20:05 UTC, Ben on the mutual conditions table: "there is great
      detail here on the right but it isn't shown on the left (e.g. it
      doesn't say court of competent jurisdiction etc)", and on No Other
      Reps / Fraud: "the detail here isn't actually reassuring, I'd just
      say yes then have the tree ready to show the language etc".
      Generator decision 26: the conditions detail column shows the fact
      as drafted (its own words in source order; the cited words stay the
      click target); the No Other Reps / Fraud table is status only.
      20:20 UTC, Ben: "I'd use the ordering from the old app for the
      sections and the left hand side bar (and for the styling of that
      side bar)". Generator decision 27 re-orders the sections to the old
      app's sidebar groups and gives each its group, label and colour;
      the rail renders those groups in the old sidebar's style, sticky,
      and the section heading dots take the group colour.
      20:30 UTC, Ben: "is extraction still working? I don't see regulatory
      yet". Generation 2 had finished; the regulatory efforts covenant
      (6.03) is missing because the extractor returned no proposals with
      every routed family UNRESOLVED, in about a minute, and the runner
      recorded the section as complete with coverage issues only. Nine of
      85 sections came back this way (3.06, 3.09, 3.13, 3.17, 3.19, 5.01
      interim covenants, 5.02 no-shop, 6.03 regulatory efforts, and one
      after a 30-minute provider timeout); NCS generation 4 under V8 had
      none. Fix: a response with no proposals and every routed family
      UNRESOLVED is now EXTRACTION_DECLINED, failing the attempt so the
      section is retried up to its three attempts and otherwise ends
      FAILED where "Retry failed sections" sees it (NOT_FOUND stays an
      answer); the extractor prompt now defines the three coverage
      states and says a declined response is rejected. Reaches the
      worker with generation 3.
      20:40 UTC, Ben on the structure grid: "why does merger form appear
      twice?" The legacy Merger Form column and the per-step form column
      both read "Merger Form" once the step suffix was dropped for a
      one-step deal; generator decision 28 removes the legacy column and
      orders the grid structure first (deal structure, merger form,
      surviving entity), then the closing mechanics.
      20:50 UTC, Ben: "it's actually the combined fact that MS is merged
      with Company and Company survives that makes it a reverse
      triangular (for the purposes of showing the basis for our views)".
      Generator decision 29: the merger form columns name their basis
      kinds (merging party, operation, party merged into, survivor); a
      readout citing fewer than the fact has is dropped with a note
      (conclusions rule C10); the extractor is told to cite them all;
      the evidence sidebar quotes, marks and lights every cited
      component of a cell. Generation 3 (submitted 20:12 UTC, run
      b437121b) started before this; its structure readouts cite what
      the extractor chose, and the sidebar shows every cited component.
      21:00 UTC, Ben on Closing Location: "the 'such other...' is the 2nd
      alternative and so should appear second. You are also missing 'as
      the parties agree..' which is an important part of such other...
      (such other means nothing by itself)". Two rules: readings that
      share a cell are ordered by where their words sit in the source,
      never by arrival; the closing mechanics lines (location, timing,
      effective time) show each fact as drafted, and the extractor is
      told a verbatim text runs to the end of the alternative it names.
      21:10 UTC, Ben on equity awards: "we should have the different
      types of option as sub items under the Company Stock Options and
      include Unvested (that do vest by their terms), Vested and then
      ones > the deal price". Generator decision 30: rows are the
      instrument classes (open), treatment classes are sub-items from a
      fixed detail list in that order, the instrument row the overview;
      extractor guidance and request updated. Extractor-side, so it
      reaches the next generation after 3.
      21:20 UTC, Ben on the Organization rep's sub-items: "clicking one of
      the qualifications shouldn't cause the others to turn orange...!
      Also the 'power and authority' should include 'to own...' etc
      otherwise it can be confused with power to enter contracts. Also -
      are these items in Term canonical and being used across all deals?
      They need to be so they can be compared". Selection now lights one
      line. Rows were canonical; sub-items were the model's words.
      Generator decision 31 gives both rep tables a canonical limb list
      per representation (seeded for Organization and Authority; the
      other eighteen await Ben's vocabulary), sent to the extractor as
      the only allowed limb names, open only when none fits.
      Ben, 21:25 UTC: "the sub items are pretty good, put that work to
      make canonical a later task (and perhaps you can suggest them once
      we have gone a few rounds with different agreements)". Seeded
      lists kept; the rest is Q5.
      21:15 UTC check-in on generation 3 (run b437121b): 22 of 85
      sections, 189 valid facts, 120 readouts, 37 notes. Twenty-two notes
      are the expected CONCLUSIONS_MISSING for exchange mechanics; ten
      readouts were dropped because the model wrote { 2023, year } for a
      lookback cited as "since January 1, 2023", one because "one (1)"
      CVR carried unit CVR. Rule: a value cell takes the code-parsed value
      of its cited words (component rule R6 applied to the readout); a
      date on the lookback column is shown as the date. Applies from the
      next generation; the ten facts are valid without a readout in 3.
      21:30 UTC, Ben on Material Contracts: "why are there two contract
      type columns and what is not covered doing? also are there
      materiality qualifiers for any of these rather than just $
      thresholds?" The harvest kept the clause's words as the row beside
      a coded type, and the print's not-covered checklist had become a
      per-row vocabulary; qualifiers were not captured. Generator
      decision 32: rows are the canonical categories, Not covered for a
      category with no fact, As drafted, Threshold and a new Qualifier
      column. Extractor-side for the qualifier and the canonical rows;
      the next generation after 3.
      21:40 UTC, Ben on the evidence sidebar: "when we show the rep's
      qualifier, I'd put some form of lighter highlighting on the whole
      rep so it is easily viewed. And I'd also make the qualifier middle
      of the view pane on the side bar. also you should be able to see
      the side bar and sourcing not just by clicking the pills. defined
      terms should be served in a table and the whole of that should be
      collapsable, and each term should be auto collapsed to start". All
      four rendered: the clause marks the whole fact lightly and the
      cited words strongly; the sidebar scrolls the marked words to the
      middle of its pane; the row name opens the sidebar on the row's
      first fact; Defined Terms is a collapsible table, each term
      collapsed until clicked.
      21:50 UTC, Ben on Consideration: "why isn't (d) the provision that
      this attaches to"; "why is there a separate 'an amount of cash' row
      and also why does it say 'any CVR' with a citation into the
      exchange mechanic?"; and on votes: "this voting section is being
      pulled from a rep...!". Generator decision 33 (appraisal from the
      APPRAISAL_LINK fact only, as drafted; per-share rows from the form
      code; only component and package subtypes in that table) with
      contract rules C11 and C12, and two schema layer rules (exchange
      procedures are EXCHANGE_MECHANICS; board resolutions recited in a
      representation are representation facts, never votes facts).
      Extractor-side; the generation after 3.
      22:16 UTC check-in on generation 3: 50 of 85 sections, 396 valid
      facts, 266 readouts, no failed sections; 5.01 and 5.02 now carry
      facts (5 and 43). Of 77 dropped readouts, 43 are the lookback date
      (fixed at 21:15), 15 are a representation qualified both by
      knowledge and by materiality dropped as "duplicate column
      materiality": a vocabulary column now accepts distinct codes as
      two readings of one cell (the same code twice is still a
      duplicate), and the table view renders both pills.
      23:02 UTC: generation 3 READY (run b437121b), 85 of 85 sections,
      631 valid facts (generation 2: 422), 409 readouts, 103 readouts
      dropped with a note (58 of them by the two causes fixed during the
      run), 54 CONCLUSIONS_MISSING notes (exchange mechanics and other
      no-readout subtypes). No declined sections: the regulatory efforts
      covenant (6.03) carries 30 facts and the no-shop (5.02) 43. The
      interim operating covenants (5.01, 57k input tokens) came back
      with 5 facts and the family marked UNRESOLVED: a partial decline
      the zero-proposal check does not catch, so the negative-covenant
      list is missing. See Q6.
- [x] Q3 Restyle to the Deal Storylines design, 2026-09-13 21:45 UTC.
      2026-09-14 00:10 UTC, Ben on Antitrust / Regulatory and Intervening
      Event (verbatim in the shapes note, decision 34 proposal): the
      harvest left free-text Provision / Detail columns and, for the three
      sections without print, a one-row-per-subject table, and the
      redesign had gone section by section as Ben pointed. Proposal put
      to Ben: no fragment columns anywhere (coded, number, yes / no or as
      drafted only) and a shape per remaining section, listed in the
      note for his sign-off before generation 4.
- [x] Q7 Decision 34 applied, 2026-09-14 03:30 UTC. Ben, 2026-09-14:
      "why would you use top build? You know it is missing many
      provisions. Use bain/envestnet but then look at all of the output
      yourself and analyze if you think it is right or wrong and if not,
      iterate to improve it"; "just go through Metsera first and fix it
      all to be perfect before you go off on another deal"; "What
      terrifies me atm is that you actually don't know what the fuck you
      have extracted". Every section of generation 3 was read against
      the agreement text: `docs/codex-program/notes/METSERA-GENERATION-3-AUDIT-2026-09-14.md`
      (the component layer is granular and accurate; the table layer,
      four family and subtype assignments, one long-section partial
      decline and a few empty sections are the defects, each with its
      fix). The Envestnet old-app page (`scripts/product/legacy-review-print.js`)
      is the specification; `scripts/product/table-shapes-decision-34.js`
      rebuilds every remaining section to its row list with coded,
      number, yes / no or as-drafted columns only, with `vocabulary_by_row`
      (rule C13), presence-derived cells from another family (rule C14),
      a D&O section, boilerplate rendered collapsed, and the extractor
      request carrying the new fields (shapes note "Decision 34
      applied"). Also fixed: the declined-extraction rule no longer fires
      on a replayed recording with a stated provider incompatibility
      (`tests/product-phase-4.test.js` had been failing since 03eeca4a).
- [x] Q6 Long sections, 2026-09-14 03:30 UTC. A section over 12k bytes
      with four or more child limbs is extracted per group of limbs
      (about 8k bytes each, the chapeau, definitions and cross-references
      as context, `part_instruction` naming the part), each part checked
      for a decline on its own, the parts merged with the part number
      prefixed on every ref (`longSectionGroups`, `mergePartResponses`,
      `tests/product-long-section-split.test.js`). The analysis runner
      passes `LONG_SECTION_SPLIT`; a direct call of the section builder
      extracts whole, so the recorded fixtures replay unchanged. Cost: one extraction
      call per part for the few long sections (Metsera 5.01: about four
      calls in place of one that partially declined). Ben may set the
      thresholds (`LONG_SECTION_SPLIT`).
- [ ] Q8 Generation 4 (Metsera). Ben, 2026-09-14: "Why can't you do
      this git stuff?" / "Server side route is fine. Tell me how to get
      you the vercel stuff you need". Built: the internal bearer token
      path (`PRODUCT_INTERNAL_TOKEN` on the deployment; the actor is the
      login user) and explicit sandbox credentials from the environment,
      with `scripts/product/start-generation.js`. Once Ben sets
      `PRODUCT_INTERNAL_TOKEN` on the Vercel preview environment and gives
      this environment `PRODUCT_INTERNAL_TOKEN`, `VERCEL_TOKEN`,
      `VERCEL_TEAM_ID` and `VERCEL_PROJECT_ID`, the cycle runs from here:
      `node scripts/product/update-sandbox-worker.js`, then
      `node scripts/product/start-generation.js <preview-url> <sec-url> 4`.
      2026-09-14 02:45 UTC: Ben supplied both tokens in chat ("with these
      can you proceed?"). Done from here: `PRODUCT_INTERNAL_TOKEN` set on
      the deal-corpus preview environment for the codex branch through the
      Vercel API and the branch redeployed; the session middleware also
      had to admit the bearer (c0be3039); Vercel Authentication on preview
      deployments is passed with a share link from the Vercel connector
      (`get_access_to_vercel_url`, a cookie per deployment, 23 hours),
      never by weakening the project's protection; a deployment's own
      `VERCEL_PROJECT_ID` had tripped the credential check (158e0428).
      Worker updated to the codex branch head; run
      `42a597b2-0f9e-4405-8ac5-e0535a51dc1a` submitted (explicit
      generation 4, stored as source generation 5: the run read as
      generation 3 is stored as 4) and woken (HOSTED, command
      cmd_d4d1e6c4d2c54252af26be0f383c). 03:30 UTC, read while the run
      was at 13 of 85 (Articles I and II, 3.01, 3.03): the merger form
      cites all three basis components; cash, CVR and the package code
      correctly; the appraisal provision is extracted; the fixed rows
      hold. Defects found and fixed in code for the next generation
      (`lib/product/agreement-draft.js`, `fact-components.js`,
      `fact-conclusions.js`, the overlay, decision 34): (1) sixteen
      facts INVALID because the model cited a verbatim quote on a
      sibling limb's span or with an occurrence index past the last
      occurrence (1.06 "the directors of the Surviving Corporation",
      occurrence 1 of a phrase that appears once); the resolver now looks
      for the quote across the section and clamps the occurrence,
      recording both on the evidence context. (2) 1.04 INVALID on
      "CROSS_REFERENCE must resolve" for "Section 259 of the DGCL": a
      statutory reference needs no resolution. (3) Eight readouts dropped
      on as-drafted cells whose text the model paraphrased: an as-drafted
      cell now needs only its citation. (4) 2.02 (8.9k bytes, seven
      limbs) took one 13-minute call and yielded one fact: the split
      threshold is 8k bytes. (5) 2.03 award treatment came back as
      EMPLOYEE_MATTERS with invented rows; the overlay names it
      CONSIDERATION/EQUITY_AWARD. (6) Merger Sub's share conversion coded
      as a per-share "Other" row: overlay and guidance exclude it. (7) The
      appraisal line's source was invalid: the line now takes
      CONSIDERATION/APPRAISAL_LINK, else the APPRAISAL_DISSENTERS_RIGHTS
      facts, never an invalid one. (8) The Article III introduction got a
      readout row: guidance excludes it. Model-side errors left as they
      are: one 2.01 fact citing an unknown span, one LIST without
      elements, one PERCENTAGE with no number. 04:15 UTC, 3.02 to 3.16
      read at 26 of 85: (9) the 3.05 consents limb had become an
      ANTITRUST_REGULATORY filing with an invented code and Tax
      definitions were forced into ACQUISITION_PROPOSAL: the overlay
      keeps the consents limb a representation and adds
      OTHER_DEFINED_TERM (d957b8e3). (10) Thirteen of the twenty-seven
      3.13 Material Contract categories lost their readout
      (CONCLUSIONS_DROPPED) because the provision cell quoted the clause
      across its category and its nested exception and the space-joined
      component texts lost the comma between them: a verbatim cell is
      now compared word by word over the cited components in source
      order, whole words only, never an added word. (11) The two limbs of
      the 3.13 no-default representation, and the valid-and-binding and
      full-force limbs of 3.13(b), were held as DUPLICATE_FACT_OCCURRENCE
      because both quote one sentence: under V2 a collision whose
      candidates have distinct component footprints re-keys them and
      keeps them valid; identical footprints are still held. Model-side
      and left: a 3.16 component with no byte range, a 3.12 lease limb
      with LIST_ELEMENTs outside a LIST. (12) 3.04 (authority, board
      approval, takeover statutes) was routed IMMATERIAL because the
      router reads the catalogue's allowed fact types, and 3.08 (absence
      of changes) to INTERIM_OPERATING alone, so neither was extracted as
      a representation although the residual pass named REPRESENTATIONS
      on their paragraphs (the same two sections were empty in generation
      3). The routing is now widened, never narrowed, by two facts the
      code holds: a section under an article headed "Representations and
      Warranties" is routed to REPRESENTATIONS, and a family the residual
      pass names on a paragraph of the section is routed; the record
      keeps the model's own answer and says what was added and why. 04:40
      UTC, at 45 of 85: every empty section so far (3.22 brokers, 3.23
      fairness opinions, IV-INTRO, 4.03 authority, 4.06 brokers, 4.08
      Section 203, 4.09 funds) is the same IMMATERIAL routing of a
      representation, which the widening now catches; 3.21 (insurance)
      is all-INVALID on quotes cited with an occurrence index past the
      last occurrence, the case (1) fixed after the worker was updated.
      3.17, 3.18, 3.20, 3.25, 3.26, 4.01, 4.04 and 4.07 read clean
      (row_detail names each limb; 4.04 lists each consent exception).
      (13) 6.01 (Parent, as sole stockholder, adopts the agreement) came
      back twice, as a GENERAL_COVENANTS Merger Sub obligation and again
      as a MERGER_STRUCTURE_CLOSING transaction step with an empty row:
      the overlay now says a covenant in the additional agreements
      article is never a transaction step. (14) 04:48 UTC: 5.01 (the
      interim operating covenants, extracted in parts) was recorded
      FAILED with SECTION_LEASE_EXPIRED while its worker was still on it:
      one failed lease renewal stopped the heartbeat for good. A renewal
      the store refuses as stale still loses the section at once; any
      other failure is retried while the lease has time
      (`withSectionLeaseHeartbeat`). The claim order picks the failed
      section up again while attempts remain, so the run continues.
      (15) 04:59 UTC, at 49 of 85: the run went FAILED on 6.06 with
      "codex exited 1: " three times in three seconds. Reproduced in
      the sandbox: the Codex CLI on the ChatGPT login answers "You've
      hit your usage limit. Visit https://chatgpt.com/codex/settings/usage
      to purchase more credits or try again at Sep 20th, 2026 11:53 AM".
      No more model calls are possible until Ben buys credits or the
      limit resets; the four sections in flight (3.19, 5.01, 5.02, 6.03)
      will expire too. In code: a non-zero Codex exit with nothing on
      stderr now reports the last JSON error event from stdout, and the
      hosted worker stops with PRODUCT_HOSTED_CODEX_USAGE_LIMIT instead
      of burning three attempts per section. Generation 5 resumes with
      "Retry failed sections" once the account has credits; generation
      6 (every fix above, worker updated to the codex head) follows.
      Ben, 2026-09-14: "Can you flip the codex cli to Claude cli?" Done
      in code: provider ANTHROPIC_CLAUDE_CLI_SUBSCRIPTION runs Claude
      Code (`claude -p`, already installed in the sandbox at 2.1.224) on
      a Claude subscription login, Claude Opus 5 on every call kind, the
      same hosted worker, wake and run identity rules as the Codex path;
      the branch's PRODUCT_MODEL_PROVIDER is flipped. Outstanding, Ben's:
      the login token from `claude setup-token`, set on the deployment as
      PRODUCT_CLAUDE_CODE_OAUTH_TOKEN. 10:29 UTC: Ben supplied the token
      ("or is it better to use Codex CLI? Codex has usage again"); set on
      the deployment, redeployed, verified with one Claude Opus 5 call
      from the sandbox, worker updated to 8a0017c, generation 6 submitted
      (run `0764b437-baa0-4a8d-b714-1975a1bb60f0`, stored generation 6)
      and woken on Claude. Codex stays available by flipping
      PRODUCT_MODEL_PROVIDER back; Claude was chosen because the Codex
      account ran dry mid-run and Claude Opus 5 is the stronger reader.
      Ben's first reading of the generation 6 page, 2026-09-14: "we
      shouldn't just be dumping in the full text in the summary" (the
      closing row): an as-drafted cell now shows the fact's operative
      core (its own actor, operation, object and term words) plus the
      headline's distinguishing components, in source order with an
      ellipsis for skipped words; the whole fact stays behind "See
      provision" and the MAE carve-back footer stays in full. "this
      portion is stated to be a fact without a coded readout but it is
      part of the structuring that describes a reverse triangular merger
      so it is used" (Merger Sub's existence ceasing): a one-row table's
      fact with no cell of its own now backs the row instead of being
      listed as evidence without a readout. Both are page rules
      (`lib/product/table-view.js`), so they apply to every generation
      already stored. Further readings the same morning, each a page or
      shape rule: "this says nothing - needs to say which entity is the
      surviving entity" (a party column names the actor, term after it);
      "the term should [be] in [the] LH column and the definition on RH"
      (Defined Terms split by `definedTermParts`); "these four - hand off
      to an agent ... render them as a hidden 'other provisions' section
      under the main structure and mechanics parts - needs to be high
      level" and "consider if you can show them as one fact in the layer
      tree with 'Branches'" (a collapsed Other provisions block, facts cut
      from one sentence as one line with a branch per fact); "the
      background summary app lives on deal corpus - I want you to
      completely copy the visual style - including the page header" (the
      deal summary header card and table framing, `pages/deals/[id].js`);
      "this should just say 'present'" (the appraisal line is a Present
      pill); "I'd get rid of 'as drafted'" on the per-share grid and "I'd
      put them under the word 'cash' and 'CVR' in component and also
      present the combined definition" (defined term under the component,
      the Merger Consideration as the table's combined definition); "all
      of this is miscoded. This is the standard intro to the reps that
      provides the exceptions for all reps ... show the reader the general
      categories of the exceptions (SEC filings) and as they click into
      deeper levels show more detail" (subtype REPRESENTATION_QUALIFICATION
      and a general qualifications table with rows per category for
      generation 7; generation 6's introduction facts sit under that table
      as other provisions meanwhile). "I'm surprised I haven't seen an
      employee equity section yet?": 2.03 completed at 10:52 UTC and the
      Equity Awards section filled (options and restricted stock rows,
      consideration, vesting and CVR entitlement coded). Later readings
      the same day: "So, right now this is confusing as the Company Stock
      Option rows shows conflicting treatment ... Consider showing those
      as the main row (don't change name) and then say 'Exceptions' and
      show the sub rows?" (a row's own line is the general case, its
      sub-items the exceptions, `sub_rows_label`); "'see provision' has
      too much visual hierachy and color which distracts readability"
      (a quiet control after the subject); "for the definition, take out
      of table but when you click the MAE box and the side bar opens,
      there is a fixed visual element at the bottom of the side bar that
      has the MAE definition summary which you can click through to get
      the full definition" (pinned to the sidebar's foot, "Full
      definition" jumps to the section); "make the elements below the top
      level reps (e.g. Organizzation) collapsable and hide them initiall
      but have a clear 'more detail' button" ("More detail (N)" /
      "Exceptions (N)" under the subject). After the first look at that
      deployment: "I don't like the 'see provision' behaviour - it
      shouldn't show the provision x-refs but instead should open the
      side bar" (the control opens the row's first fact in the sidebar)
      and, on the Other provisions block, "I assume this isn't how you're
      going to render this when you're done? It should look like the rest
      of the table structure etc and for now no summary is fine but
      ultimately we want to get to summary" (the same card and Term /
      Provision columns as the grid, the section reference as the Term,
      branches as indented rows; the summary is a later rule). On the
      unvested option sub-row: "While fully vested is normally right I know
      why this is coded as such but it should say Fully Vested (Conditional
      Upon Service) or similar" (vesting code
      FULLY_VESTED_CONDITIONAL_UPON_SERVICE in the equity awards shape with
      guidance for generation 7; a stored "accelerated" cell whose fact
      carries a continued-service condition reads that way already).
      (16) 11:25 UTC, at 13 of 85: generation 6 went FAILED on 3.02
      (Capitalization) after three attempts. Claude Code's `result`
      field is the last text block of the answer; at high effort the
      model emitted its JSON in several text blocks with thinking
      between them, so the client saw the tail alone (attempt 2:
      CLAUDE_PRODUCT_JSON, the text beginning mid-object; attempt 3:
      MODEL_RESPONSE_SHAPE). The CLI now runs with
      `--output-format stream-json` and the client joins every assistant
      text block in order (`claudeJsonResult`). Two blind spots fixed
      alongside: the claim of the next attempt erased the failed
      attempt's error, so `product_phase1_fail_section` now appends each
      failure to `product_section_work.error_history` (migration
      `20260914120000_product_section_attempt_history`), and the hosted
      worker's stdout was unreachable once the wake command's id was
      gone, so `launch.sh` tees it to `/vercel/sandbox/pm-worker-<run>.log`.
      Worker updated to a8aa63ca; the run retried through
      "Retry failed sections" at 11:28 UTC. The sections already stored
      (Article I, 2.01, 2.03, III-INTRO, 3.01, 3.03 to 3.05) read
      correctly on the page: the Organization, Capitalization,
      Authority and No Conflict rows carry their sub-items, the excepted
      filings of 3.05 sit under the row as exceptions, one 3.03 fact is
      INVALID (a LITANY with children, the model's error). 3.02
      completed at the first attempt on the updated worker (26 facts, all
      VALID); 3.07, 3.08 and 3.10 read correctly, except that 3.08 cited
      "Since January 1, 2025" as a DATE with no Lookback cell: a value
      column the extractor leaves empty is now filled from the fact's own
      fill_from component when its words parse (`derivedValueCell`), so
      the Absence of Changes row shows January 1, 2025 and Labor Matters
      January 1, 2023.
      (17) 11:55 UTC, at 17 of 85: FAILED again, on 2.02 and 3.09. 3.09
      (eleven limbs, 7k bytes): Claude Opus 5 at high effort answered
      with over 89k output tokens, past Claude Code's 64k cap, and the
      continuation was a second object ("resume_note": "Continuing ...
      truncated by the output limit") that the joined stream could not
      parse. In code: the long-section split now starts at 5,000 bytes
      and three limbs in parts of about 3,500 bytes (3.02, 3.06, 3.09
      and 2.02 all split), the system prompt asks for compact JSON, and
      the case is named CLAUDE_OUTPUT_TRUNCATED. 2.02: SECTION_LEASE_
      EXPIRED on all three attempts with one renewal recorded per attempt
      (the later ticks queued behind a renewal that never returned; a
      stale renewal probed from the sandbox hung over a minute because
      SQLSTATE 40001 is retried by PostgREST). In code: a renewal that does
      not answer in 60 s counts as a transient failure and the next tick
      renews on its own request, every renewal outcome is written to the
      worker's log, and the lease functions raise P0001 (migration
      `20260914123000_product_section_stale_errcode`). Worker updated and
      the run retried.
      (18) 12:20 UTC: on the updated worker, split sections (2.02, 3.09,
      3.11, 3.13, 3.17) ended about five minutes into extraction with no
      model call and no failure on their rows while the worker moved on:
      the phase-3 advance swallowed a section error whose failure record
      was itself refused. In code: the section error and a refused record
      are logged, the record is retried without model calls, and the
      phase-2 fail function raises P0001 too. Worker updated to 8fa3b9be
      and woken; the cause reads from the log at the next occurrence.
      Ben, 2026-09-14: "we didn't have this issue with codex, right?
      Maybe flip back over?" (the output-cap truncation is Claude's, the
      lease loss was seen on Codex too in generation 5; staying on Claude
      for this run, one deployment variable flips back) and "do you have
      an agent looking at all of our tweaks and seeing if they should be
      made systematically/throguhout the. code base back to extraction? I
      don't want to make surface lvel/one deal level fixes": every
      render-side rule since 2026-09-13 audited; the ones compensating
      for the extractor now have upstream counterparts (party columns'
      guidance and display sent in the request; DEFINED_TERM resolves_to
      = the definition words; article introductions held to
      REPRESENTATION_QUALIFICATION with INTRO_NOT_QUALIFICATION; an
      omitted value column completed from the fact's parsable fill_from
      component at extraction; C15 drops a vocabulary code whose
      contradicted_by words the fact carries, FULLY_VESTED_ACCELERATED
      against continued service; plain component labels). Left for Ben:
      a `headline.summary` field on the fact contract for the
      other-provisions Term (a contract and store change).
      (19) 12:43 UTC, from the new log: every split section failed with
      "invalid product model invocation identity". A part's call carries
      an identity derived from "<attempt token>:part-<n>" so the parts of
      one attempt do not collide, but the admission check derived it from
      the bare token; the split path (added after generation 5) had never
      recorded a call in the hosted worker. Migration
      `20260914125500_product_model_call_part_identity`: the expected
      identity follows the part number the call's request carries. No
      worker change; the failed sections retry under attempts remaining.
      13:12 UTC: the identity needed two more passes (the part number
      sits in the provider request's message content, at its top level);
      2.02's part 1 was admitted at 13:12, the first split-section call
      ever recorded in the hosted worker.
      (20) 15:15 UTC, reading 6.03 on the page: no Efforts standard row
      and no Remedy commitment row, though 6.03(a) is the reasonable best
      efforts covenant and the no-divestiture proviso. The model calls
      show three parts covering (b), (c) to (f) and (g); (a) was in none.
      When limb (a) runs on from the heading line the structure keeps it
      as the section's own text and only (b) onwards are children, so the
      split put (a) in the chapeau span, sent it to every part as context
      and told each part to answer for its listed limbs only. All ten
      split sections of generation 6 lost their (a) this way (5.02(a) the
      no-shop covenant itself, 5.01's "shall not" chapeau, 2.02(a) the
      paying agent, 3.13(a) the material contracts list, 6.05(a) the
      charter indemnification continuation, 3.09(a), 3.11(a), 3.17(a),
      3.19(a)); no fact of any of them has an OWN component in the
      chapeau range. Fix in `longSectionGroups`: the section's own chapeau
      span leads the first group (its own part when it is long, as
      6.03(a)'s 4.1k bytes is), the part that carries it says so
      (`extraction_part.covers_chapeau`, "treat those words as a limb of
      this part") and the LONG_SECTION_SPLIT issue records
      `chapeau_in_part`. Generation 6 stands as extracted; generation 7
      carries the fix.
      (21) 15:40 UTC, Articles VI to VIII read against the text. 7.01's
      Stockholder Approval condition was INVALID: the model cited its
      words on a span id that is in no closure, though the words are the
      section's own. A quote on an unknown span that is verbatim in the
      section now resolves against the section's full span (recorded as
      `unknown_span_resolved_from`); one absent from the section stays
      UNKNOWN_SOURCE_COMPONENT. 7.02's second bring-down tier and the
      buyer's officer certificate came back with no readout and fell under
      "without a readout" though their rows are fixed: a closing
      condition's row follows from its fact type (`fact_type_rows` on the
      three conditions tables, "FACT_TYPE:SUBTYPE" the more specific key)
      and the party's table from the statement's words
      (`statement_words`); `defaultConclusions` gives such a proposal that
      row at extraction (note CONCLUSIONS_DEFAULTED) and the page applies
      the same rule to stored facts. Performance of Covenants repeated
      itself as a sub-item ("True in all material respects"): a sub-item
      made from a column's value stands only beside another. 6.11's
      adjournment for insufficient votes had no code (INSUFFICIENT_VOTES
      and PARENT_REQUEST added to the permitted reasons). 8.01's outside
      date read as its own extension and the extension as an outside
      date: the omitted-cell completion read each fact's one DATE into
      both DATE columns; a component read into a value column of one kind
      is not read into another of that kind (generation 6's stored cells
      keep the doubling; generation 7 does not). Open, for generation 7's
      read: the tail fee's threshold (8.02's 20% to 50% variant of the
      takeover proposal definition is a KEY_DEFINED_TERMS fact, and the
      tail-fee table takes TERMINATION_FEE only) and the willful breach
      definition (8.02(a)) sit under "without a readout"; the general
      covenants Access row shows every standard of its twelve facts
      joined, not a summary; 6.03's efforts and remedy rows wait on the
      split fix.
      (22) 15:50 UTC, Article IX. The MAE definitions table said "One
      limb — effect on the business" for the Company (whose definition
      has the ability-to-consummate limb too) and nothing for Parent
      (whose has that limb alone): the precedent's one code could say
      neither. The summary is now derived by the page from the row's own
      prong facts (`derived: { join: 'limbs' }`: a prong whose words
      speak of consummating is the ability limb, any other the business
      limb; codes for one of each and for both), never coded by the
      extractor. The carve-back footer, the carve-out rows with their
      disproportionality answers, the no-other-reps table and the
      boilerplate rows read correctly; 9.03's "underlying cause counts"
      parenthetical sits under "without a readout" by decision 25.
      (23) 15:55 UTC: generation 6 READY, 85 of 85, none failed, 817
      proposals (799 VALID, 18 INVALID). The run's issues: three facts
      INVALID on a LITANY built with children and no members (3.03,
      3.15, 4.04; the children are now its members) and two on
      "twenty percent (20)% or more" (5.02; parenthesised and spelled
      percentages parse); 27 capitalisation readouts dropped for naming
      the representations table (the page's security-class rule places
      them); 62 readouts missing, 21 of them exchange mechanics by
      decision. The section-by-section reading is
      `docs/codex-program/notes/METSERA-GENERATION-6-AUDIT-2026-09-14.md`.
      Generation 7 starts on the worker at the head of this branch and
      is read the same way.
      (24) 16:35 UTC: generation 6's page frozen as a static copy
      (every section open, no sidebar) at
      https://claude.ai/code/artifact/502d2ef5-634b-4fe0-8440-192a10c342df,
      the live run page staying at its run URL. Generation 7 submitted
      as run `8c53fb92-06c9-40f1-b6b3-f9da5cdf7b3d` (stored generation
      7) on the worker at e7d675d, woken 16:35 UTC.
      (25) 16:50 UTC, generation 7's Articles I and II.01 read: the
      summaries hold ("Merger Sub merges with and into the Company at the
      Effective Time"; "Each Company share receives $47.50 cash plus one
      CVR"). Fixed from the read: the Other provisions Term had become
      the summary sentence with the drafted words as the Summary (the
      Term stays the label-built term, the summary is the Summary cell);
      five summaries dropped for naming Section 259, Section 262 or
      Article VII (a statute's section, numbered without a dot, and an
      Article of the agreement are content; the agreement's own dotted
      section numbers stay refused); the cash amount read "$47.5" (cents
      kept); the six appraisal mechanics of 2.01 had no section at all
      and fell off the page (APPRAISAL_DISSENTERS_RIGHTS joins the
      consideration section: they are the grid's Other provisions).
      (26) 17:05 UTC, Ben: "can you make the deploy not have a reference
      to codex or claude etc?" The branch preview now has the project
      domain `deal-corpus-preview.vercel.app`, assigned to the branch
      `codex/product-implementation-plan-20260904` on the Vercel project
      (it follows every push to the branch; Vercel Authentication still
      guards it). The generated alias with the branch name in it keeps
      working but is no longer the link given out.
      (27) 17:15 UTC, generation 7's 2.02 and 3.01 to 3.04 read. The
      split fix holds: 2.02's limb (a) (the paying agent's selection,
      the agreement, the Closing Amount deposit, the CVR-funds
      carve-out) is extracted, the chapeau in part 1 of 4. The
      capitalization table fills from 3.02 and 3.03 (800,000,000
      authorised, 105,278,627 outstanding, 6,331,920 reserved, the
      option, RSA and ESPP counts, the subsidiary equity row) with the
      absences as its Other provisions. 3.01 coded "Except as disclosed
      in SEC filings" on the Organization row though the article
      introduction's exceptions are the General Exceptions row's: the
      intro row's own codes are dropped from every other row, at
      admission (note CONCLUSIONS_CELLS_DROPPED) and on the page for
      stored facts. Summaries naming "Code Section 409A" or "DGCL
      Section 203" were dropped by the worker's rule of that hour; the
      relaxed rule (25) keeps them from the next worker update.
      (28) 17:30 UTC, Ben: "from gen 6 please remove 'State: draft, not
      published / Date: September 21, 2025 / Source: EX-2.1 ·
      0001193125-25-210030 / Generation: 6 / 799 layered facts across 85
      sections · 18 held by validation, not shown. Click a row or a pill
      for the words behind it.'" The header is the eyebrow with the
      state chip, the title and the rule; the metadata line and the
      count line are gone from every run's page.
      (29) 17:40 UTC, generation 7's 3.06 to 3.10 read. 3.09's limb (a)
      (the tax filings, payments and returns) is extracted and its
      tax-asset disclaimer stays off the No Other Reps table; 3.06, 3.08
      and 3.10 read correctly with their look-backs. Two defects found
      in the run's issues: the KEY_DEFINED_TERMS overlay in the schema
      builder had two `add` keys, the second silently replacing the
      first, so OTHER_DEFINED_TERM (added after generation 5) never
      reached the contract and every other definition was refused as
      UNSUPPORTED_SUBTYPE (3.09's Tax definitions in generation 7); one
      list now, the subtype with the family's roles and relationships
      and a fact type of its own (OTHER_DEFINED_TERM_RECORDED), the
      contract regenerated. And 3.08's "conducted business in the
      ordinary course" and "no action that would have breached the
      interim covenants" lost their readouts whole on one value cell the
      model wrote without { canonical, unit }: the cells a problem names
      are dropped and the readout revalidated, so the row survives (note
      CONCLUSIONS_CELLS_DROPPED); a readout with a problem beyond its
      cells is still dropped as before. The worker is updated to this
      head mid-run so the definitions sections ahead (5.02(h), 9.03)
      take the schema.
      (30) 17:44 UTC: 3.11 failed on the old worker with FACT_LINK_SPAN
      (a QUALIFIES link citing a span in no closure was a hard section
      failure, five model calls lost). A link on an unknown span is now
      dropped with UNSUPPORTED_FACT_LINK and the facts stay. The worker
      was updated twice in a quarter of an hour (f5c00f4, then c616f56)
      and its process killed each time; the leases those kills left
      behind expire on their own and the sections retry under their
      attempts.
      (31) 18:20 UTC, generation 7's 3.12, 3.13, 3.16 to 3.18 read. The
      Material Contracts table is the precedent's list filled from the
      definition: 26 categories, each with its summary, the thresholds
      parsed from the words ($500,000 indebtedness and leases,
      $2,000,000 goods and services, manufacturing, CRO, royalty,
      milestone and future-payment contracts, "two million dollars" for
      commercialisation, $50,000 employee loans), the materiality
      qualifiers, no absent rows; 3.13's and 3.17's limb (a) extracted.
      The reps rows of 3.12, 3.16 to 3.18 carry their qualifiers and
      look-backs (January 1, 2023; June 30, 2025 for undisclosed
      liabilities). 3.16's two definition cells were dropped as
      non-verbatim and the rows kept (the cell rule of (29) at work).
      3.18 had one fact INVALID on two LIST_ELEMENTs outside a LIST: such
      an element is now built as a TERM.
      (32) 18:40 UTC: 3.11 completed at its third attempt on the fixed
      worker; with the schema of (29) its definitions (ERISA, ERISA
      Affiliate, Non-U.S. Benefit Plan) and 3.14's (Proceeding, Judgment)
      come through as OTHER_DEFINED_TERM facts, which had no table: they
      are entries of the Defined Terms section, the quoted name the term
      and the summary the definition. 3.14, 3.15, 3.19 to 3.22 read
      correctly on their rows.
      (33) 19:30 UTC, generation 7's 5.01 read: the covenant
      introductions Ben asked for are there, from the opening words the
      split now extracts. The general-terms table opens the section
      with the consent standard (not to be unreasonably withheld), the
      general exceptions (disclosure letter, the Agreement, applicable
      Law, Parent's consent) and the ordinary course standard; the
      affirmative covenants (preserve the business organisation with
      commercially reasonable efforts; maintain material assets) and 33
      restriction rows with their thresholds ($2,000,000 acquisitions
      and capex, $500,000 indebtedness), exceptions and sub-items. Three
      facts had no home: the "specific restrictions govern the general
      covenant" carve-out (a fourth general-terms row, Specific
      restrictions govern) and two DIVIDENDS-family coordination facts
      (the family joins the section; the Dividends and Distributions
      row takes them by fact type), the Company's or Parent's table
      chosen by the statement's subject; a defaulted readout cites the
      fact's own words for the as-drafted column so its summary shows.
      Article IV read correctly with Merger Sub's 1,000 shares on their
      own capitalization row.
      (34) 19:29 UTC: the run went FAILED at 50 of 85 with two sections
      failed in twenty seconds, five attempts recorded as "claude exited
      1: " and no reason. The reason was in the stream: Claude Code ends
      a refused turn with a result event carrying is_error and "You've
      hit your session limit · resets 8:40pm (UTC)" (Ben's account,
      429). The client now reports that text (the Codex fix of (15)
      extended to the Claude stream), "session limit" counts as a usage
      limit, and the worker stops with PRODUCT_HOSTED_CODEX_USAGE_LIMIT
      instead of burning attempts. 20:44 UTC, the limit reset: the two
      sections retried and the run is RUNNING again.
      (35) 20:50 UTC, generation 7's 5.02 read: the no-shop's limb (a)
      is extracted (solicit, negotiate, waive a standstill;
      representative control; 48-hour notice), the fiduciary-out, the
      change-of-recommendation mechanics, the intervening event (four
      business days' notice, the excluded events), the 50% Superior
      Proposal threshold, the 20% Company Takeover Proposal definition
      and the matching rights all on their tables. Ten of its facts were
      INVALID on legacy checks while their component trees were whole:
      six change-of-recommendation facts on a missing permitted_trigger
      role, three 48-hour notice facts on a period unit the model named
      differently, one match-period fact on "two business days" beside
      "four business days". Under the layered model a compiled tree is
      the fact: a missing legacy role or an unsettled legacy value is a
      NOTE and the fact stays VALID (evidence problems and role
      collisions still hold it). Nine facts without a readout (the
      deemed-breach and no-restricting-agreement clauses, the bidder
      information permission, the once-only reaffirmation, three
      definitions the model typed OTHER_DEFINED_TERM) stay under
      "without a readout" or the Defined Terms; the model's readouts,
      not new page rules, are the fix for those.
      (36) 21:30 UTC, generation 7's Article VI and 7.01, 7.02 read.
      6.03 is the proof of finding (20): its limb (a) yields fifteen
      facts, the Efforts standard row (Reasonable best efforts, with the
      additional-instruments and ordinary-course carve-out sub-items)
      and the Remedy commitment row (No remedy required, each of
      clauses (A) to (F) a sub-item, the Company's conditioned-on-Closing
      undertaking as Remedy only if conditioned on Closing), plus the
      takeover-statute covenant on the Other Covenants table. 6.05's
      limb (a) fills the Charter and contract continuation row
      (assumption, survival, six years, no adverse amendment). 7.01's
      Stockholder Approval condition is on the mutual conditions table
      (finding (21)'s unknown-span rule). 6.04's benefit rows, 6.10 and
      6.11's proxy timetable with the adjournment reason coded
      Insufficient votes, 6.06's five publicity sub-items, 6.12 to 6.14
      read correctly; 6.15 stays UNRESOLVED_UNUSUAL_PROVISION.
      (37) 21:50 UTC, generation 7's Articles VII and VIII read: the
      three bring-down tiers of 7.02 as sub-items with their standards
      and the sections they cover, 7.03's two tiers, the certificates,
      the frustration rule with a branch per party; 8.01's rights with
      the 30-day cures and the earlier-of rule; 8.02's fee, triggers,
      timing per trigger, exclusive remedy, interest and the 12-month
      tail; 8.05's board-action formalities. The outside date row still
      showed both dates in both columns though the stored cells were
      right: the page's own value completion (the safety net for stored
      generations) read each fact's one DATE into the other column; it
      now skips a component another value column of the same kind
      already reads, as the extractor's completion does. The
      willful-breach definition and its knowledge standard (no table for
      them) are Defined Terms entries, as every readout-less definition
      fact now is; the once-only fee clause is a line of the Sole and
      exclusive remedy row. Ben's afternoon decisions,
      2026-09-14, each in code: "by miscoded I meant oyu currentl have it
      messed up and you need to move it over to what we had in the old
      vesrion...." (the reps table opens with General Exceptions: SEC
      Filings, Disclosure Letter, Other, the cut-off in Lookback and the
      excluded portions as qualifier pills; and Knowledge: Standard,
      Persons; the separate general-qualifications table retired;
      generation 6's intro facts placed by their words); "sure add a
      table" (Capitalization: rows per security class, authorised /
      issued / reserved / as-of counts parsed from the cited words,
      absence facts as the footer); "1. for now - yes" to an
      extractor-written summary on every fact (headline.summary, at most
      15 words, validated, stored on the headline row, the Other
      provisions Term; a malformed one is dropped with a note, never
      holds the fact); "4. I don't cte" (provider stays Claude). Sidebar:
      "hide detail under the full layer tree as the default. Also call it
      Interpretation Tree and also why do we show the greyed out text and
      the rest? Can't we just do the bit in highlight and below?" (closed
      to start, own components only). "the background summary app lives
      on deal corpus - I want you to completely copy the visual style -
      including the page header": rendered side by side with the deal
      page; the header title is the two parties with the badge on the
      title line, no "Published summary" heading, the sidebar in the deal
      card style; the black rail of 2026-09-13 kept pending Ben's word.
      Later on 2026-09-14, each in code: "also font etc doesn't match the
      deal storylines page. Also their pages are 'cleaner' in style" (the
      page restyled from Ben's Deal Storylines screenshot: Inter, the
      black rail with the parties as title, eyebrow and large title over a
      black rule, sections as cards with tinted header bands, chips, no
      shadows); "on UI - I still see this at the top and the left hand
      side bar is not flush to the side of the page?" (no Corpus shell,
      the rail the page's left edge); "please fix relative sizes" /
      "zoom level is the same" (every size scaled by 0.58) then "sidebar
      width now good but font size not good" (fonts raised by 1.3);
      "can we kill 'as drafted' columns throughout - the whole point is
      to only ummarize the key parts!! ... Also same comment on
      'provision' columns" (a detail column shows headline.summary only
      and is dropped when no row has one); then "sorry I think you are
      confused. By 'provision' I don't mean summaries like this - this is
      what I want. I just saw some blank provision columns and thought
      you were goign to include x-refs or full contract lanugage...!" and
      "Can we rename that as 'Summary'" (the coded summary column stays;
      its header is Summary in every shape, the page grid and the Other
      provisions table); with a screenshot of the Deal Storylines event
      panel, "I prefer this side bar behavior from corpus" (the sidebar is
      that panel: fixed to the viewport's right edge and scrolling on its
      own while the page scrolls under it, 406px; eyebrow, 21px title and
      an X; plain-word tabs with the active one underlined in the accent;
      Detail as bold-headed sections divided by rules: Provision (the
      summary and the cited words, each with a "Source" chip that turns
      to the clause), Interpretation Tree, Clause, then a closed
      "Supporting record detail" disclosure holding the checks and
      provenance; the Source tab the section's text with the words
      marked; Comments the review trail; the selected pill outlined in
      the accent as the selected event card is); "change the title of the
      page that appears in a browser to Corpus - Pfizer / Metsera" (the
      tab reads "Corpus - " and the deal title); on clicking Cash plus
      CVR, "the side bar focuses to the clause itself but I would prefer:
      1. the sidebar to show first the interpretation tree with the
      clause x-ref added and then a 'jump to text' button that then
      jumps down to the actual language" (the panel opens at its top with
      the tree first, the section reference and a Jump to text button
      beneath it that centres the marked words; the Provision words and
      the Clause follow); on the capitalization table, "can we tidy up
      this no other securities other provisions like in the other
      sections?" (the absence facts are the table's Other provisions
      block, titled No other securities); "don't show any 'not covered'
      material contract categories" (no absent rows on that table); "we
      don't need to show 'consent' for each row of the negative covenant
      but we do need the general affirmative and negative covenant intros
      in the IOCs which I don't see (look at prior version). Also make
      negative covenant list collapsable (if it is within the covenant
      section)" (the consent column is gone; the general-terms table,
      the covenant introductions, opens the section; the restriction
      list folds behind a toggle. The introductions are missing from
      generation 6 because 5.01's opening words were never extracted,
      finding (20); generation 7 carries them); "I will have intervening
      event / no shop comments but will wait for the next turn"; "(1)
      save a version of this page that will work even after the next
      generation some how so I can see it - and send me a link and (2)
      then run the next generation". Reading the second half of
      the run: 3.09's tax-asset disclaimer had filled the No Other Reps
      table (a subject-limited disclaimer is the representation's
      exclusion: held at extraction by the section heading, and on the
      page by its words); IV-INTRO had fallen into the Company table (a
      readout naming a retired table is none); Merger Sub's capital had
      merged into Common Stock as "0.01" (its own row; a count column
      never reads a money amount; counts print with separators);
      "forty-eight (48) hours" read as 8 (parenthetical digits win,
      compound number words add up); "6 year" (period units plural);
      overlapping components repeated words in summaries (written once).
      (38) 22:09 to 22:50 UTC: every section complete, the run FAILED
      at DRAFT_FINALIZATION twice, both in the pipeline, both fixed for
      every run. DRAFT_NESTED_IDENTITY on one 3.14 proposal: the
      section results are read 500 rows a page and the component rows
      were ordered by (proposal_id, ordinal), not a total order (a child
      and a top-level sibling share an ordinal); the tie fell across the
      2,500-row boundary, Postgres ordered the tied rows differently on
      the two pages, one row came back twice and one never, and the
      rebuilt tree no longer hashed to the id. Every paged order now
      ends in the table's key; a store test pages a double that
      resolves ties differently on each page. Then
      DRAFT_COVERAGE_COMPLETENESS on 2.01's
      OTHER_DEFINED_TERM_RECORDED: finding (29)'s schema fix added a
      required fact type mid-run and six sections (2.01, 2.03, 3.02,
      3.03, 3.09, 3.12) extracted before it carry no assertion for it.
      Their stored extraction requests name every fact type the model
      was asked to cover, so a fact type absent from all of them is
      schema drift: the draft records a draft-level
      SCHEMA_DRIFT_FACT_TYPE issue, the family's coverage of that fact
      type stays UNRESOLVED, and validation accepts the missing
      assertion only when the drift is evidenced and recorded; a
      missing assertion for a fact type the model was asked about is
      still a failure. The finalisation retry of
      `product_phase3_retry_run` returned the run to RUNNING and the
      wake finalised it: READY at 22:50 UTC, 937 proposals, 916 VALID.
      Lesson recorded: a change to a family's required fact types
      during a run is drift by construction; the next such change is
      made between runs.
      (39) 23:15 UTC, generation 7's Article IX read: 9.01 to 9.11 on
      their Miscellaneous rows (survival, notices, eighteen
      construction rules, severability, counterparts, entire agreement,
      the third-party beneficiary carve-outs as sub-items, Delaware,
      assignment, the Chancery forum, specific performance with the
      Company's right to compel the closing, jury waiver), 9.07's
      disclaimers, non-reliance and fraud carve-outs on the No Other
      Reps table and the indemnified parties' enforcement right on the
      D&O table; 9.03's carve-outs on the fixed rows with their
      disproportionality answers, Knowledge on the reps table's second
      row, 17 new Defined Terms and 11 already entered. Three defects in
      9.03, each fixed in code: the Company MAE came back as one prong
      fact (the consummation limb) and the page read "One limb" again
      (the layer rule now asks one DEFINITION_PRONG per limb, never the
      consummation limb alone); the underlying-cause proviso had no
      readout and no place (the carve-out tables' footer takes both
      provisos, `footer_from_subtype.subtype_keys`, a footer fact needs
      no readout, and one without a readout resolves to its family's
      table by the party its words name); the scheduled-matters
      carve-out lost its summary to the summary rule's reading of
      "Section 9.03(a) of the Company Disclosure Letter" as a section of
      the agreement and its row showed an empty cell (a Disclosure
      Letter section is content; "Matters scheduled in the Disclosure
      Letter" is a fixed row). The reading is
      `docs/codex-program/notes/METSERA-GENERATION-7-AUDIT-2026-09-14.md`.
      Open: the page does not yet show the draft-level drift issues;
      the six drift sections' definitions are generation 8's; Ben's
      intervening event and no-shop comments.
      (40) 2026-10-17 23:00 UTC, Ben: "are you the overall / managing
      chat for the precedent machine / corpus project?" and "can you
      reorganize yourself as required and then give me clear
      instructions on what you need from me then prepare to proceed?"
      Since Phase 5B the manager session had also been the implementer
      (code, runs, reads, plan). The section 10 loop is restored: the
      manager session (session_014yr9q51NS76fiRGycShhxz) keeps this
      checklist, reads the output, decides and talks to Ben; a fresh
      implementer session (session_01FcuVU62gzc5H166ZEAXYLP, on the
      product branch) takes work packages by message and reports its
      diff, behaviour and tests for review. Work package 1: the page
      shows draft-level SCHEMA_DRIFT_FACT_TYPE issues; generation 8
      readiness confirmed by tests; finding (41) by the implementer.
      The manager submits generation 8 after Ben's intervening event and
      no-shop comments. The 5B.6 prerequisites (worker update script,
      the schema variable on the preview environment) are in place from
      the manager's side, so the NCS rerun waits only on Ben's go.
      (41) 2026-10-17 23:20 UTC, work package 1 of the section 10 loop,
      generation 8 readiness. The page shows finding (38)'s drift: the
      preview read (`loadCompletedSectionResults`) keys every issue by
      its section node, so a draft-level issue (structure_node_id null)
      never reached the page; `loadDraftIssues` reads those rows, the
      preview handler carries them in `analysis.issues` beside the
      sections' own, and `previewFactsFromWorkspace` returns them as
      `schema_drift` (section, family, fact type; section order, then
      fact type). The page sets one line per entry under the title in
      the grey the metadata line used ("Section 2.01:
      OTHER_DEFINED_TERM_RECORDED (KEY_DEFINED_TERMS) joined the schema
      after this section was extracted; not covered in this
      generation."), only when the draft recorded any; the tables are
      unchanged, so a reader sees which sections this generation never
      asked about a fact type instead of reading their silence as
      coverage. Checked, from the request builder and its tests, that
      the extraction request carries finding (39): the MAE_DEFINITION
      layer rule (one DEFINITION_PRONG per limb, never the consummation
      limb alone) rides in `component_instruction` through
      `layerRulesText`; the summary rule names a Disclosure Letter
      section as content and `headlineSummaryProblems` accepts one; the
      carve-out tables' footer did not reach the model: the request
      read `footer_from_subtype.subtype_key` alone, so the two tables
      that took `subtype_keys` in (39) were sent with no footer. The
      request now sends `footer_subtype_keys` for either form and one
      sentence of `conclusion_instruction` says what a footer is. The
      carve-out guidance had also asked for row_label "Underlying cause
      proviso" on the UNDERLYING_CAUSE_RESTORATION fact while the
      section's no_conclusions_subtype_keys told the model to omit its
      conclusions; a footer fact needs no readout (39), so the guidance
      now says so and the contract is regenerated. Finding (38) is the
      pipeline, not the prompt: nothing of it belongs in the request.
      Browser check (section 9, one per UI change): the page rendered
      with its compiled Tailwind in headless Chromium, with six drift
      lines (the generation 7 sections) and with none; the lines sit
      between the title and the rule in the metadata grey and the
      tables are untouched. No run submitted; generation 8 waits on
      Ben's comments.
      (42) 2026-10-17 23:30 UTC. Work package 1 reviewed and accepted
      (finding (41); the implementer also found that the extraction
      request read footer_from_subtype.subtype_key alone, so after (39)
      the MAE tables' footer reached no prompt: now footer_subtype_keys).
      Ben's generation 7 comments, verbatim, each to code in work
      package 2: "when I clicked 'see provision' on 'definition' in
      'intervening event mechanics' the main body of the page leapt
      around, it should stay static and the left hand side should just
      come up. Also, in the the right hand side bar - I like
      interpretation tree, 'provision' - should that read as How Corpus
      Interpreted (or sometihng better osunding!) and then 'clause' -
      what is that? The full section it comes from? Be clearer? Also
      look at this one, not formatted very prettily and also random page
      breaks and pagen umbers...!"; "another UI point - why do we have a
      summary column here? Also 'period' as a column is wasteful as it
      only applies to one provision? Consider that point generally?";
      "On substance, you're missing the fiduciary standard required
      (which we do have in the change of rec for superior proposal
      section)"; on the no-shop: "odd under ongoing updates to have
      required within a stated period and required promptly. Also weird
      to have the 48 hours there. I know the pills are likely helpful
      for background comparison work etc but do we need to show them
      here? Consider this more generally on the UI pills etc"; "Also,
      need ot include the detail of what info of what must be shared in
      the no shop (i.e. just contracts, etc) and when and orally etc. A
      lot more detail required". The page numbers ("-43-") are in the
      canonical text from the SEC HTML page footers; they are hidden at
      display, never removed from the text (spans and hashes stand).
      Generation 8 waits for work package 2 and Ben's answer on the two
      readout-less 5.02 clauses.
      (43) 2026-10-17 23:45 UTC onward, implementer, work package 2 (the
      manager's message of 23:38 UTC; items A1 to A3 first, then B4, C5,
      C6). The page leapt because the tables' content column took 406px of right
      padding while a fact was selected, so every table reflowed on a
      click; the column now keeps one width and the fixed panel comes up
      over the page, as the Storylines panel does (finding (37)).
      `ProvisionTables` takes `initialSelection` so a static render can
      show the open state. The page numbers are hidden at display and
      never removed from the text: `lib/product/source-display.js`
      (`hidePageFooters`, a footer on a line of its own between the words
      of a sentence; `factWithoutPageFooters`, a display copy of a fact
      with its bytes and ids untouched) is applied where words are shown:
      the clause and source panes (`section-highlight` parts, after the
      bytes are sliced, so the marks stand), the interpretation tree
      (`renderLayer`), the sidebar's cited words, and every table word
      (`buildTableView` maps its facts once; `factOwnText` and
      `factSummaryText` too). A hyphenated word or an inline "-5-" is
      left alone. A footer at a paragraph break keeps one break; a
      front-matter roman numeral ("-ii-") is a footer too. The sidebar's
      blocks are renamed (A2): "Provision" is "How Corpus read it" (the
      summary and the cited words are Corpus's reading; "read" is the
      plain verb for what it did, shorter than "How Corpus Interpreted"),
      "Clause" is "Source text · Section 5.02" with the note "The full
      section these words come from, as drafted; the cited words are
      marked.", and the tab that holds the same text is "Source text";
      "Interpretation Tree" stays. The section is set as one block per
      line of the canonical text (which already puts each paragraph and
      lettered limb on its own line), limbs indented by depth ("(a)" one
      step, "(i)" two, "(A)" three; `partsToLines` in
      `lib/product/section-highlight.js`), the marks riding inside their
      lines, no preformatted run. Verified by hand in headless Chromium:
      the tables keep full width under the open panel; Concho's 6.3 with
      a cited run across "-45-" shows the words and the clause without
      the footer, limb (a) indented, the marks in place.
      B4, one column and pill rule for every table (`applyColumnRules`
      in `lib/product/table-view.js`, written once in the codebase
      guide's table bullet): (a) a value or vocabulary column filled on
      only one line of a table with several rows (absent rows not
      counted) folds into that line as a trailing detail after its
      subject, a quiet control that opens the sidebar on its cell
      ("Notice period · 48 hours"; the detail names its column unless
      the subject already does, "Common Stock · Authorised
      800,000,000"); (b) a vocabulary pill whose label the line's
      summary already states is not shown, its code kept on the cell
      under `stated_in_summary`, and a column that leaves empty is
      dropped; (c) the summary column stays. Columns that change under
      the rule depend on each run's rows; on the test fixtures the
      capitalization table's Authorised column folds into the Common
      Stock row, the notice table's Period column folds into its one
      filled row, and "Required promptly" pills beside summaries that
      say so are hidden. The live list for generation 7 is read from
      the page once the branch deploys.
      C5 and C6, in the shapes (`scripts/product/table-shapes-decision-34.js`,
      contract regenerated), the layer rules
      (`scripts/product/build-legal-schema-v2.js`, contract regenerated)
      and the page default. The intervening-event table's "Board-change
      standard" row is "Board determination standard", the fiduciary
      table's name and vocabulary (Ben: "you're missing the fiduciary
      standard required (which we do have in the change of rec for
      superior proposal section)"); its guidance names 5.02(f)'s clause
      as that row, the layer rule asks for the standard as a fact of its
      own on the intervening path, and a stored readout-less
      EXCEPTION_PREREQUISITE or RECOMMENDATION_CHANGE fact whose words
      name the Intervening Event and the fiduciary duties defaults to the
      row (`fact_type_rows` gated by the new `fact_type_rows_when`
      regular expression, validated in `lib/product/table-shapes.js`,
      honoured by `defaultConclusions`), so generation 7's fact, if it
      has one, shows now. Generation 7 had no fact on the old row, so
      the rename costs no stored readout. The notice table is 5.02(d)'s
      own mechanics as fixed rows: Initial notice (timing, and the
      trigger as a second code: knowledge of an executive officer or
      director, or receipt), Notice contents (identity of the person;
      copy of a written proposal, inquiry or request; material terms
      when oral; modifications; draft documentation; status and
      developments), Ongoing updates (timing; the two content codes),
      Notice of a decision to engage (timing), Oral proposals (may ask
      that an oral proposal be made in writing; judged to belong here
      because it governs how a proposal is communicated), and, per Ben's
      "yes to both" (finding (44)), No agreement restricting information
      to Parent (Yes / No); one timing code per row,
      "promptly, and in any event within 48 hours" coded as the stated
      period with the summary saying promptly, the 48 hours in the
      Period column that folds under B4 when one row alone states it;
      the deemed-breach sentence is the sub-item "Representative breach
      is Company breach" under Representative control standard, Yes / No
      (the manager's addendum of 23:52 UTC, Ben's "yes to both" quoted
      in the shape comments). Both sentences have page defaults for a
      stored readout-less PROHIBITED_ACTION fact whose words are the
      sentence (`fact_type_rows` with `fact_type_rows_when` on the core
      and the notice table), so generation 7's facts for them, if any,
      take the rows. The NO_SHOP layer rule names each notice duty as
      its own fact. Left out, as asked: nothing else of 5.02 moved.
      A5 (finding (47)), in `components/product/PublishedSummary.jsx`
      (`childrenCoverParent`): a parent whose children together cover
      its words, with nothing but a list's connectives (and, or, plus,
      either, both) between them, is shown as its children, each
      indented one level, with no line of its own and no toggle; a
      parent with words of its own shows them with its children indented
      beneath, no toggle; list elements such as (i) and (ii) are separate
      indented lines; every line is one text style, left-aligned (the
      italic grey of inherited words and the dotted underline of a
      reference term are gone; the test ids stay). The manager's A.5
      message of 00:12 UTC is met with two readings to note: a list's
      connectives between the children ("(i) ... and (ii) ...") count as
      covered, since Ben's own example is such a list and the parent
      would otherwise repeat its children with "and" as its only word of
      its own; and no toggle appears above the fourth level, where the
      fourth level and below fold behind one control. This supersedes the
      closed-by-default detail of 2026-09-14: the tree is open to three
      levels. Verified by hand in headless Chromium on a 2.01-shaped
      fact: "shall be converted into the right to receive" above its
      object, "(i) $47.50 in cash" and "(ii) one CVR" as two indented
      lines in the list's place, the defined-term line left-aligned.
      Work package 2 closed 2026-10-18 00:05 UTC: commits 38ce6f3,
      4ebe868, 2cc1b74, eade833 and ced5dd0 on the branch; `npm run
      test:active` 635 of 636, the one failure the known Codex-client
      final-message test; no run submitted. Open for the manager: the
      live list of columns B4 folds on generation 7 (read from the page
      once the branch deploys), and generation 8 under the new shapes
      and layer rules.
      (44) 2026-10-17 23:45 UTC, Ben, on the two readout-less 5.02
      clauses (the Representative deemed-breach sentence as a sub-item
      "Representative breach is Company breach" under Representative
      control standard; the no-restricting-agreement sentence as a row
      "No agreement restricting information to Parent" on the rebuilt
      notice table): "yes to both". And: "Agreed on all following it -
      also you now have $200 of API tokens you can use if you want to
      preseve subscription capcaity". Decisions: both rows join work
      package 2; generation 8 runs when work package 2 lands; NCS, then
      Olaplex and Apogee, follow it. The ANTHROPIC provider in the code
      (lib/product/anthropic-model.js) runs only inside the web request
      on Sonnet with a 12,000-token output cap, not on the hosted worker
      with the split and the Opus tier the subscription runs use; work
      package 3 brings the API provider to the hosted worker at the same
      model tier, output cap and part splitting, the key read from the
      preview environment like the OAuth token and never from the
      repository, with a cost estimate from the published prices and
      generation 7's token counts before any run is submitted on it.
      (45) 2026-10-17 23:55 UTC, Ben: "done on the key, will be live on
      your next redploy". ANTHROPIC_API_KEY is on the deal-corpus
      project's preview environment (set by Ben in Vercel; its value was
      never in this session). Work package 3 is queued to the
      implementer for after work package 2: the ANTHROPIC provider on
      the hosted worker (the wake passes the key to the sandbox as it
      passes the OAuth token; same model tier, part splitting and output
      cap as the Claude CLI path; usage limits and the 429 path handled;
      the run's model_config names the provider so the run page shows
      which account paid), with a per-run cost estimate from the
      published prices and generation 7's 9.85m input and 3.15m output
      tokens. Generation 8 goes on whichever path is ready first, Ben
      choosing by the estimate.
      (46) 2026-10-18 00:30 to 01:15 UTC, implementer, work package 3
      (the manager's message of 00:40 UTC; built on the terms of (44)
      and (45) and then brought to the message). No run submitted; no
      live API call made from here; no key value anywhere in the
      repository or a fixture. The Anthropic API is a hosted provider
      beside the Claude CLI path. Its id is `ANTHROPIC_API`, not
      `ANTHROPIC`: repository evidence is that `ANTHROPIC` is the
      in-request provider (Sonnet, 12,000-token cap, `run-handler`'s
      in-process path) and the default whenever PRODUCT_MODEL_PROVIDER
      is unset, so making that id hosted would route every default run
      to the sandbox and break the in-process path and its tests; the
      manager may rename it. The hosted provider (`lib/product/
      product-model-config.js` `ANTHROPIC_API_MODEL_CONFIG`,
      `lib/product/anthropic-api-model.js`): the CLI path's model tier
      and effort per call kind read from that path's map (claude-opus-5;
      routing and residual low, extraction high), a 64,000-token output
      cap so a 60,000-token extraction completes (the CLI path runs
      under Claude Code's own cap), adaptive thinking (the model's
      default; no sampling parameter, which the model refuses), the same
      compact-JSON system prompt, streaming, the runner's LONG_SECTION
      split and part handling untouched, the same recorded shape
      (prompt_version, `model_id` as `claude-opus-5;effort=high`, the
      whole prompt as input tokens, cost_microusd from the price table).
      The price table is one constant with its source and date
      (`ANTHROPIC_API_PRICES`: https://platform.claude.com/docs/en/about-claude/pricing
      read 2026-10-18; claude-opus-5 $5 input, $6.25 5-minute cache
      write, $10 1-hour cache write, $0.50 cache read, $25 output per
      million tokens; claude-opus-5-5 $4 / $5 / $8 / $0.20 / $20). The
      key: ANTHROPIC_API_KEY on the deployment, read by the run route,
      passed to the sandbox command's env by the wake exactly as
      CLAUDE_CODE_OAUTH_TOKEN is and only for this provider, required
      by the launcher and the worker, unset by the launcher for every
      other provider. A 429 after the SDK's retries, or a 400 naming the
      credit balance, is ANTHROPIC_API_USAGE_LIMIT; the worker stops on
      it with the reason recorded (PRODUCT_HOSTED_CODEX_USAGE_LIMIT, the
      code's existing name), as on the CLI paths; a refusal or an answer
      cut off at the cap fails the call with the received output kept.
      Choosing per run: the intake takes an optional `provider`,
      validated against the hosted providers (anything else is a 400),
      and the run's model_config records it; the run route drives a run
      on the provider its own model_config names whatever the
      environment's default; the analysis read carries `model_provider`
      and the provisions page shows "Anthropic API" / "Claude
      subscription" beside the state chip. To submit one run on the API
      while the environment default stays the subscription, POST
      /api/product/intake with the internal bearer token and the body
      {"url": "<sec exhibit url>", "idempotencyKey": "<new key>",
      "explicitGeneration": <n>, "provider": "ANTHROPIC_API"}, then POST
      /api/product/analysis/<run_id>/run as today; or, in one line,
      `node scripts/product/start-generation.js <preview-url> <sec-url>
      <generation> --provider ANTHROPIC_API`. The sandbox worker must be
      on this branch head first (`update-sandbox-worker.js`), and the
      preview deployment redeployed since Ben set the key. Estimate
      (`scripts/product/estimate-run-cost.js 9,853,912 3,146,447`, the
      generation 7 tokens, prices of 2026-10-18): input $49.27 plus
      output $78.66, $127.93 per generation on claude-opus-5 with no
      cache reads (the request sets no cache breakpoint today; the
      contracts and table shapes repeat on every section, so a
      breakpoint on them is the first lever, about $97 if two thirds of
      the input read from cache); $102.34 on claude-opus-5-5, a
      different model from the CLI path's. Ben's $200 covers one
      generation with margin, not two. Tests:
      `tests/product-anthropic-api-provider.test.js` (provider
      selection, the request shape, cost, limits, the wake's env with no
      key value asserted, the run route, the intake field, the analysis
      read, the estimate), the worker's key check and its stop on a 429
      in `tests/product-hosted-worker-pool.test.js`, the provider on the
      preview page. Commits 2d2c6f4, 7709441, 1eadf1d and 58ae85c;
      `npm run test:active` 649 of 650, the one failure the known
      Codex-client final-message test. Work package 3 closed 2026-10-18
      01:00 UTC; the manager's review and Ben's choice of path for
      generation 8 are open.
      (47) 2026-10-18 00:05 UTC, Ben, on the 2.01 Consideration package
      tree in the sidebar: "hitting 'show detail' doesn't add much...just
      smae stuff again? Also, we should better indent the (i) and (ii)
      for the right to receive that is shown". The parent component's
      words are the join of its children, so the toggle repeats them;
      and the defined-term line "(clauses (i) and (ii), collectively,
      the 'Merger Consideration')" sits centred and underlined. Added to
      work package 2 (A.5): a parent whose children together cover its
      words shows its children in its place, indented one level each,
      with no toggle; a parent with words of its own shows them with its
      children indented beneath, no toggle; list elements such as (i)
      and (ii) are separate indented lines; every tree line uses one
      text style, left-aligned.
      (49) 2026-10-18 01:25 to 01:50 UTC, implementer, work package 4 (the
      manager's message of 01:21 UTC): the persistent worker sandbox
      `pm-codex-preview-worker` idled a month and no longer resumed
      ("Status code 400 is not ok: Cannot resume sandbox: no snapshot
      available"). Nothing was run against Vercel from here; the manager
      runs the scripts. `isSandboxGone` in `lib/product/sandbox-wake.js`
      names a gone sandbox for every caller: a 404, a missing snapshot
      (410 snapshot_not_found, @vercel/sandbox 3.2.1's own check), or the
      older 400 on a resume. A wake on one fails as PRODUCT_SANDBOX_GONE
      and the run route answers 503 with that code, not a 500.
      `update-sandbox-worker.js` says in one line that the sandbox no
      longer resumes and names the create script. `create-sandbox-worker.js`
      serves every hosted provider: `--provider` (ANTHROPIC_API,
      ANTHROPIC_CLAUDE_CLI_SUBSCRIPTION, OPENAI_CODEX_CLI_SUBSCRIPTION;
      default PRODUCT_MODEL_PROVIDER, else ANTHROPIC_API), `--branch`;
      credentials from `sandboxCredentials()` (VERCEL_TOKEN,
      VERCEL_TEAM_ID, VERCEL_PROJECT_ID in the shell); a stale record is
      found with resume off and deleted with its orphan snapshots (the
      SDK's own getOrCreate does the same on 410, not on the 400 the
      server gave), then the sandbox is created under the same name,
      persistent, with snapshots that do not expire
      (`snapshotExpiration: 0`), the branch cloned, `npm ci --omit=dev`,
      /vercel/.codex (the launcher's flock file) and
      /vercel/sandbox/pm-cli/bin made, the modules-load check run for the
      provider's model module; the Claude CLI provider also installs
      @anthropic-ai/claude-code into pm-cli (no login; the OAuth token
      arrives per wake), the Codex provider installs @openai/codex and
      runs the device login as before, the API provider installs nothing
      more. It prints the sandbox id, the commit and the CLIs installed,
      never a credential. The manager's command, from a shell with the
      three Vercel variables set: `node scripts/product/create-sandbox-worker.js
      --provider ANTHROPIC_CLAUDE_CLI_SUBSCRIPTION` for generation 8 on
      the subscription (the manager's recommendation in (50)), or
      `--provider ANTHROPIC_API` for the API path; a later provider only
      needs its CLI, so `update-sandbox-worker.js` plus one
      `npm install -g --prefix /vercel/sandbox/pm-cli <cli>` in the
      sandbox, or a re-create. Tests:
      `tests/product-sandbox-worker-scripts.test.js` (gone detection, the
      wake and the 503, the update message, the provider option, the
      create flow per provider with a fake sandbox API, no credential in
      any output). Commits 92e6373 and 6593d4d; `npm run test:active`
      656 of 657, the one failure the known Codex-client
      final-message test. Work package 4 closed 2026-10-18 02:05 UTC.
      (50) 2026-10-18 01:20 UTC, manager review of work packages 2 and 3
      (findings (43), (46), (48)): accepted. The suite on the merged
      head is 649 of 650 (the known Codex-client failure). The key
      handling reads correctly (the wake passes ANTHROPIC_API_KEY only
      for the API provider, the launcher unsets it for every other path,
      no value anywhere in the repository). Generation 7 under the new
      page code: the notice table's timing pills fold under rule B4 and
      the two placed rows take their defaults; four no-shop facts stay
      without a readout until generation 8 extracts on the new rows; the
      intervening-event table's "Parent termination right on a change"
      line is a derived row with no summary (open). The implementer's
      provider id `ANTHROPIC_API` stands (the in-request `ANTHROPIC`
      path keeps its name). Found on the way to generation 8: the
      persistent sandbox no longer resumes ("Cannot resume sandbox: no
      snapshot available" after a month idle), so work package 4
      (finding (49)) reworks create-sandbox-worker.js for every hosted
      provider; the manager runs it, then updates the worker and submits
      generation 8. Cost (finding (46), prices read 2026-10-18): $127.93
      per generation on claude-opus-5 at generation 7's token counts
      without caching, about $97 with a cache breakpoint on the repeated
      contracts, $102.34 on claude-opus-5-5. Recommendation to Ben:
      generation 8 on the subscription (no charge, the limit resets);
      the API for NCS after a cache breakpoint lands.
      (51) 2026-10-18 02:07 to 02:25 UTC, Ben: "Go ahead and" (the
      recommendation of (50)). Work package 4 (finding (49)) merged;
      suite 656 of 657 (the known Codex-client failure). The sandbox was
      recreated for the Claude CLI path (`create-sandbox-worker.js
      --provider ANTHROPIC_CLAUDE_CLI_SUBSCRIPTION`: the stale record
      deleted, cloned at d001711, Claude Code 2.1.302 in pm-cli). The
      first two wakes answered 503 "not configured" with nothing in the
      log: the run route now logs the failure's code, which was
      PRODUCT_SANDBOX_STARTUP_FAILED, the launcher exiting 78 because its
      `command -v claude` check ran before pm-cli joined PATH (the old
      sandbox had the CLI on the default prefix). PATH is exported before
      the provider checks; the sandbox checkout updated to 172b961.
      Generation 8 (Metsera, explicit generation 7, stored generation 8)
      is run `72d94dd2-cb59-49cf-8f46-c89d161b7769`, submitted 02:10 UTC,
      RUNNING from 02:20 UTC on the subscription with two workers; the
      manager monitors it and reads it section by section as
      generations 6 and 7 were read; the API path (finding (46)) is held
      for NCS after a cache breakpoint.
      (52) 2026-10-18 03:10 UTC, generation 8 at 15 of 85 (1.01 to 2.03,
      III-INTRO, 3.01 to 3.05; 175 proposals, 173 VALID; one attempt of a
      split part failed on output shape and is retrying under its
      attempts). Articles I and II and the capitalization read as
      generation 7's did, the absences as the capitalization table's
      Other provisions, the 3.02 and 3.03 definitions in Defined Terms.
      Two gaps, both to work package 5: three fair summaries dropped at
      16 words against the 15-word cap (1.03's filing of the Certificate
      of Merger; the Article III introduction's two General Exceptions
      summaries), so the cap tolerates 18 while the extractor is still
      asked for 15; and three families have no table in the shapes
      (TAX_MATTERS, FINANCING_COVENANTS, GUARANTY_FINANCING_PARTY), so
      2.02's transfer-tax allocation fact is on no page at all: a Tax
      Matters section and a Financing section with rows from the
      subtype, page defaults for the stored facts.
      (54) 2026-10-18 04:00 UTC, generation 8 at 26 of 85 (3.06 to 3.16
      added; 332 proposals, 328 VALID; no failed section). Work package 5
      (finding (53)) merged: generation 8's 2.02 transfer-tax fact now
      sits on the Tax Matters row; suite still running at the time of writing. 3.06 to 3.16 read as
      generation 7's did (the material contracts list at 23 categories,
      3.09's limb (a), 3.11's plans and definitions). Two gaps to work
      package 6 (finding (55)): 3.13(b) and (c)'s representations about
      the material contracts (validity, no default, the disclosure list)
      have no row (sub-items of the reps table's Material Contracts row);
      and a second definition fact for a term already entered is dropped
      by the Defined Terms dedup (3.11's Company Benefit Plan exclusion,
      3.09's Tax).
      (56) 2026-10-18 04:45 UTC, generation 8 at 44 of 85 (3.17 to 3.26,
      IV-INTRO, 4.01 to 4.08 added; 479 proposals, 468 VALID; no failed
      section). Work package 5's suite: the known Codex-client failure
      only; finding (54) stands. Work package 6 (finding (55)) merged:
      3.13's validity, no-default and disclosure-list limbs sit under the
      reps table's Material Contracts row with their MAE and materiality
      cells; the 178 facts of 3.13 and 3.17 to 4.08 all have a place
      (none unplaced); IV-INTRO's joint-and-several qualification on the
      Parent table's General Exceptions row; Merger Sub's 1,000 shares on
      their capitalization row. Suite for work package 6 running at the
      time of writing.
      (57) 2026-10-18 05:35 UTC, generation 8 at 51 of 85 (4.09, 5.01,
      5.02, 6.01, 6.02, 6.04 added; 646 proposals, 635 VALID; no failed
      section; work package 6's suite clean but for the known failure).
      5.02 against Ben's comments (findings (42), (44), (47)): the notice
      table is 5.02(d)'s mechanics on its rows (Initial notice within 48
      hours of an officer's or director's knowledge; Notice contents:
      identity, a copy of a written proposal; Ongoing updates: status and
      developments, draft documentation, 48 hours; Notice of a decision
      to engage, 48 hours; Oral proposals; No agreement restricting
      information to Parent, Yes); "Representative breach is Company
      breach" Yes under the control standard; the intervening table's
      Board determination standard row is filled from 5.02(f) (its
      summary; no code yet); the fiduciary and change-of-recommendation
      tables as generation 7's with the once-only reaffirmation as a
      sub-item. Four defects to work package 7: (a) the subsequent match
      period reads 4 business days where the clause says the four become
      two ("the references to four (4) business days will be deemed two
      (2) business days": the period parser takes the first number; a
      "deemed" clause takes the deemed one, any other two-number period
      is left empty with a note); (b) 45 KEY_DEFINED_TERMS facts whose
      readout names `defined-terms-table` are in Defined Terms and also
      listed under the Intervening Event section as "without a readout";
      (c) the Board determination standard rows carry no code when the
      model gives none, though the words name the standard; (d) six
      no-shop facts have no row: the permitted contact to clarify, the
      permission to tell a bidder the no-shop's terms, the required-by-
      law and factual-disclosure permissions, the negotiation with a
      qualifying proposal, and the takeover-statute carve-out of an
      Adverse Recommendation Change.
      (59) 2026-10-18 06:25 UTC, generation 8 at 72 of 85 (6.05 to 6.15,
      7.01 to 7.04, 8.01 to 8.04, 9.01 added; 842 proposals, 830 VALID;
      two attempts failed on output shape and retried; no failed
      section). The worker died at about 06:10 UTC: the sandbox session
      the 02:07 wake created ran under its four-hour timeout and a
      generation takes six; the monitor re-woke it at 06:22 (new
      session, new worker; the two in-flight leases expire and are
      retried at the next check). Work package 7 (finding (58)) merged:
      (b), (c), (d) hold on generation 8 (no definition fact listed
      without a readout; the Board determination standard coded from its
      words; the six 5.02 permissions on their rows); (a) holds for new
      extractions only, the stored subsequent match period still reads
      4 business days, so the page re-reads a stored value from its
      cited words (work package 8, finding (60), with the willful-breach
      definition's fallback to Defined Terms and the worker keeping its
      own sandbox session alive). Articles VI to IX.01 read as generation
      7's did: 6.03 pending; 6.05's indemnification rows, 6.10 and 6.11,
      the conditions tiers, 8.01's rights and cures, 8.02's fee and tail;
      141 facts, one unplaced (the willful-breach definition, above).
      (61) 2026-10-18 07:00 UTC, generation 8 at 83 of 85 (4.04, 6.03,
      8.05, 9.02, 9.04 to 9.11 and Exhibit A added; 921 proposals, 908
      VALID; the dead worker's two leases were reclaimed by the new
      worker, no retry needed; work package 7's suite clean but for the
      known failure). Work package 8 (finding (60)) merged and verified
      on generation 8: the subsequent match period now reads 2 business
      days, re-read from its cited words and marked as such; the
      willful-breach definition is a Defined Terms entry; the run route
      has a keepalive for the worker's sandbox session. The new sections
      read as generation 7's did: 6.03's efforts and remedy rows with
      their sub-items (54 facts), 4.04, 8.05's formalities, Article IX
      on its Miscellaneous, No Other Reps and D&O rows; 143 facts, none
      without a home (one 6.03 efforts fact without a readout, the
      ordinary-course communications carve-out, is a sub-item through
      its twin). 9.03 and one more section running.
      (62) 2026-10-18 07:57 UTC, generation 8 FAILED at 84 of 85: 9.03,
      the definitions section, failed its three attempts (a 30-minute
      timeout, then CLAUDE_OUTPUT_TRUNCATED twice: "2 text blocks
      (115712 / 124260 output tokens) do not join into one JSON
      object"). The stored model calls show the cause: 9.03 has no
      lettered limbs, LONG_SECTION_SPLIT splits only a section with three
      or more operative children, so every generation has sent 9.03 as
      one extraction call; generation 7's answered with 108,331 output
      tokens and just joined, generation 8's, with the fuller readouts
      the new rows ask for, passed the cap. Work package 9 (finding
      (63)): a limbless long section splits by its paragraphs into parts
      of the usual size, each definition whole; the timeout path reports
      the output received. Then the worker is updated, 9.03 retried and
      the run finalised. The other 84 sections stand as read (findings
      (52) to (61)).
      (64) 2026-10-18 08:55 UTC, work package 9 (finding (63)) merged
      (the long-section-split tests pass; the full suite running): a
      limbless long section is extracted by its paragraphs, each
      definition whole in exactly one part, the part instruction honest
      about what a paragraph part covers; a second answer object fails
      the call at once as the output cap; a Claude CLI failure names the
      output received before it. The sandbox worker updated to bea7fb9,
      9.03 retried (gen8-9.03-retry-1) and the run woken: RUNNING at 84
      of 85 with 9.03 in its routing call at 08:55.
      (65) 2026-10-18 10:00 UTC: 9.03 completed on attempt 2 as paragraph
      parts (85 of 85), and the run then FAILED at DRAFT_FINALIZATION
      with DRAFT_PROPOSAL_VALIDATION on one 6.03 fact: RECOMMENDATION_CHANGE
      for 6.03(a)(C) ("Neither the Company Board nor any committee
      thereof shall ... approve, recommend or declare advisable ... any
      Company Takeover Proposal"), stored VALID with roles decision_maker
      and action and no permitted_trigger, the draft carrying its
      MISSING_REQUIRED_ROLE note (kind NOTE, message permitted_trigger).
      The generation 7 section rule (finding on 5.02, commit 051bc2e5)
      keeps a fact VALID when its component tree compiles and only a
      legacy role is missing, recording the note; the finalisation check
      in validateAgreementDraft still demanded every required role of a
      non-INVALID fact. Generation 7 never met it because its 5.02 facts
      were stored INVALID before that rule shipped; generation 8 is the
      first run finalised with a soft-legacy fact. Fix in the code, the
      same on every run: finalisation accepts a missing required role
      only against a recorded MISSING_REQUIRED_ROLE note of kind NOTE for
      the same family, subtype and section; without the note the fact
      fails as before (tests/product-phase-2.test.js, the Concho fixture
      with permitted_trigger dropped from the recommendation-change
      fact). Then the deploy, and the run retried at finalisation.
      (66) 2026-10-18 10:28 UTC, generation 8 READY: finding (65)'s fix
      deployed (d2a3ef9, the worker updated), the finalisation retried
      (gen8-finalisation-retry-1) and the draft finalised. 974
      proposals, 961 VALID, 13 held; 313 model calls; 10.88m input and
      3.62m output tokens; no drift issue. 9.03 read against the text:
      seven paragraph parts, 53 facts, none held; the Company MAE's two
      prong facts on one row; the two carve-back provisos as the
      carve-out table's footer; the disproportionality answers as the
      proviso gives them (A to E and I Yes; F, G, H, J No); the
      Disclosure Letter carve-out on its row with its summary; 33
      definitions in Defined Terms. Two summary defects found in the
      read and fixed in the rule: "Company Disclosure Letter Section
      3.21" (the prefixed form) was dropped as a section reference
      (3.11, 3.21); the Rights Agent summary carries one Han character
      ("Parent's选"), so a letter from another script now drops the
      summary with a note. The audit:
      docs/codex-program/notes/METSERA-GENERATION-8-AUDIT-2026-10-18.md
      (verdict, per article from findings (52) to (65), causes and
      fixes, open items). Supabase's preview branch answered two reads
      with Cloudflare 520s during finalisation; both succeeded on retry.
      Next: the NCS run on the Anthropic API after a prompt-cache
      breakpoint (finding (46)), then Olaplex and Apogee.
      (68) 2026-10-18 11:50 UTC, work package 10 (finding (67)) accepted
      and merged (1e49fd2, a fast-forward; its 13 provider tests pass
      here; its suite 678 of 679 with the known failure). Read against
      the brief: the model reads the same words in a new order (the
      closure after the contracts) plus one layout sentence in the system
      prompt, recorded in the stored request; the cache keyed per routed
      family set, the whole-schema alternative rejected for widening what
      the model reads; the 1-hour lifetime from generation 8's call gaps
      ($6.64 saved against $3.07 for 5 minutes); writes and reads priced
      from the message's own breakdown. The honest estimate replaces
      finding (46)'s: on generation 8's profile $144.99 uncached, $138.36
      with the cache (output is 62 per cent of the bill and never
      cached); on NCS generation 4's own profile (326 calls, 5.61m input,
      1.24m output under the older bundle) $59.12. Both inside Ben's
      $200 with a retry's margin ("you now have $200 of API tokens you
      can use if you want to preseve subscription capcaity"). Submitted:
      the sandbox worker at 1e49fd2, the preview alias serving it, the
      NCS intake (idempotency key ncs-gen5-api-2026-10-18,
      explicitGeneration 4, provider ANTHROPIC_API) created run
      51577c57-41b1-4b75-bcdf-c84ef2558589 as source generation 5, 104
      sections, woken at 11:48 UTC. The run's cost is priced from its
      own cache reads and writes at the end
      (`estimate-run-cost.js --run 51577c57-41b1-4b75-bcdf-c84ef2558589`).
      Olaplex and Apogee follow the NCS read.
      (69) 2026-10-18 11:27 UTC: run 51577c57 FAILED within a minute of
      the wake, zero tokens spent. Every API call answered 400
      invalid_request_error: "This API key is not scoped to a workspace,
      so this request must include the anthropic-workspace-id header
      with the ID of the workspace to use. Add the header, or use an API
      key that is scoped to a workspace." Two sections burnt their three
      attempts each and the worker stopped (PRODUCT_HOSTED_RUN_FAILED).
      Ben's ANTHROPIC_API_KEY is an organisation-level key. Needed from
      Ben, one of: a key created inside a workspace (replacing
      ANTHROPIC_API_KEY on the Vercel project), or the workspace id set
      as ANTHROPIC_WORKSPACE_ID on the project. Work package 11
      (implementer): the provider sends the header when the id is
      configured, the wake passes the variable to the sandbox beside the
      key, and a 400 naming the workspace header stops the worker as a
      configuration failure instead of burning every section's
      attempts. The run is then retried (retry resets the two FAILED
      sections; the other 102 are PENDING).
      Then every section of the output is read
      against the text the way generation 3 was, and the run log is read
      for the sections that returned no facts (3.08, 3.21 to 3.23, 4.03,
      4.06, 4.08, 4.09, 6.15) and the all-INVALID ones (3.03, 3.05,
      9.05); nothing is reported as right until it holds. Olaplex and
      Apogee wait until Metsera does.
      (53) 2026-10-18 (implementer), work package 5, begun on finding
      (52)'s terms and reconciled to the manager's message of 03:16 UTC
      when it arrived. The summary cap: the extractor is still asked for
      15 words (HEADLINE_SUMMARY_ASKED_WORDS in HEADLINE_SUMMARY_RULE, so
      the prompt and the extraction test are the same);
      headlineSummaryProblems drops a summary only over
      HEADLINE_SUMMARY_MAX_WORDS = 18, with the message naming both
      numbers ("over 18 words (19; 15 asked for)"). Ben's words on the
      summary are in the code comment ("1. for now - yes"). The rule
      text sent to the extractor does not mention the tolerance (telling
      it 18 invites 18); the why is in the comment and here. The three
      families: generator decision 34 gains applyTaxMatters (section
      tax-matters, table tax-matters-table, one row per TAX_MATTERS
      subtype: Intended tax treatment, Tax treatment protection, Tax
      reporting consistency, Tax opinion cooperation, Transfer tax
      allocation, Withholding, FIRPTA certificate, Special tax mechanic;
      no value column, no tax subtype carries a number) and
      applyFinancing (section financing, one table financing-table for
      FINANCING_COVENANTS and GUARANTY_FINANCING_PARTY, one row per
      subtype of either family, a Period value column for the payoff
      letter lead time), each with a coded Summary column, the fact as
      drafted, table guidance (which reaches the extractor with
      subtype_rows through agreement-draft.js, as every table's does;
      the schema's layer_rules for the three families are the generic
      text every family carries and are unchanged), fact_type_rows for
      the families' required fact types, and a new shape flag
      default_rows_from_subtype (validated in validateTableV3; read by
      defaultConclusions) so a stored fact whose fact type the shape does
      not name still lands on its subtype's row. Rail groups Tax Matters
      and Financing after Other Covenants; the sections sit after D&O and
      before the boilerplate. A deal without financing: the three
      families are not coverage_only in the schema, and a section whose
      families returned no facts never renders (table-view builds
      sections only for those with rows or listed facts), so the section
      is absent, not collapsed; asserted in the table-view test.
      table-shapes.v3.json regenerated (30 sections, 48 tables, 153
      columns); every V2 family now has a page (asserted in the shapes
      test). The Summary vocabularies (taxable
      acquisition / 368(a) reorganisation / other; paid by Parent,
      Company, Surviving Corporation, holder or shared; withholding
      permitted and withheld amounts treated as paid; efforts standards;
      no recourse against financing sources, forum and jury waiver,
      third-party beneficiaries) are the implementer's proposals from the
      subtype descriptions, not a lawyer decision: Ben and the manager
      adjust the codes; the rows are the schema's subtypes and need no
      decision. Tests: the contract test's 16-word summary now passes and
      a 19-word one fails; new cases in the shapes test (rows, defaults,
      rail groups, order, the two validation codes) and the table-view
      test (readout-less transfer-tax, withholding, payoff and limited
      guaranty facts on their rows, nothing listed without a readout).
      The rail test's group count moves from 17 to 19. npm run
      test:active: 659 tests, 658 pass, the one failure the known
      Codex-client final-message test, before and after the
      reconciliation to the manager's message.
      Generation 8 is unaffected: its stored facts take the new rows on
      the next page render, no re-run.
      (55) 2026-10-18 (implementer), work package 6 on the manager's
      message of 04:05 UTC. The material contracts limbs: generator
      decision 34 gains applyMaterialContractLimbs, which follows the
      Knowledge definition's path on the company representations table
      (MATERIAL_CONTRACTS joins the section at low confidence; the
      Material Contracts row's detail labels are Disclosure list,
      Validity and enforceability, No default; the three subtypes join
      only_subtype_keys; a new shape field limb_rows_from_subtype,
      family -> subtype -> { row_label, row_detail }, validated in
      validateTableV3 and against the section's families). The page
      rule in table-view.js places a stored fact of those subtypes
      without a readout on its sub-item and reads the Qualifiers cell
      from the qualifier words it carries (MATERIALITY_QUALIFIER,
      QUALIFIER, STANDARD, EXCEPTION, CONDITION components: "Material
      Adverse Effect" is MAE_AGGREGATE, "in all material respects" the
      partial true-in-all-material-respects code, "knowledge" the
      knowledge-qualified code, a bare "material" MATERIAL_TO_THE_REP;
      one code per limb, the first that matches in that order; codes
      outside the column's vocabulary never used). fact_type_rows was
      not used for this: the gate is family and subtype, as the message
      asked, because a stored fact's fact_type is whatever the extractor
      wrote and only the subtype is validated. The extractor: the reps
      table (with its guidance naming the limbs and their row) and the
      list table now both reach the MATERIAL_CONTRACTS family's
      table_shapes, as the KEY_DEFINED_TERMS family's do; the list
      table's guidance says the limbs are never its rows; the family's
      layer rules (schema overlay, legal-schema.v2.json regenerated) say
      the limbs are facts of their own subtypes, one per sentence, each
      carrying its qualifier, and where their readouts go. The fallback
      table resolution prefers a family's high-confidence section, so a
      material contract fact with no readout and no rule still lists
      under Material Contracts, not under the representations (asserted).
      The parent representations table is untouched. The Defined Terms
      dedup: collectDefinitionFact keeps the kind of each entry; a
      definition fact replaces a component reading of its term in place
      (fact_id, section and definition become the definition fact's) and
      two definition facts of one term merge their summaries with "; "
      (an identical repeat is not joined); order-independent, asserted
      both ways. Tests: shapes (fields, guidance, parent untouched, layer
      rule, three validation codes), table-view (the four 3.13 limbs on
      their sub-items with MAE (aggregate), a category fact still under
      its own section, no limb on the list table; the Tax and Company
      Benefit Plan cases), fact-conclusions (a limb readout to the row is
      valid; a category readout to the reps table is not). The materiality
      word rules are the implementer's; Ben or the manager adjust the
      codes. Generation 8's stored facts take the sub-items on the next
      page render. npm run test:active: 662 tests, 661 pass, the one
      failure the known Codex-client final-message test.
      (58) 2026-10-18 (implementer), work package 7 on the manager's
      message of 05:45 UTC, the four defects of finding (57). (a) The
      value parser: parseComponentValue collects every value of the kind
      the text states; a deeming form (deemed, shall be, will be, reduced
      to, replaced by, between a stated value and a later one) reads the
      deemed value, so 5.02(e)'s "the references to four (4) business
      days will be deemed two (2) business days" reads 2 business days;
      any other text naming two different values reads nothing, and the
      extractor notes the empty cell as VALUE_AMBIGUOUS_<KIND> (PERIOD,
      AMOUNT, PERCENTAGE, DATE; ambiguousValueComponents, the note beside
      CONCLUSIONS_CELLS_DROPPED in agreement-draft.js). The page's own
      completion (derivedValueCell) reads the same parser, so generation
      8's cell shows 2 business days on the next render; a two-period
      text leaves the cell empty and the row shows the summary alone,
      both asserted in the table-view test. (b) `defined-terms-table`:
      the shapes say its section is a reference appendix, not a fact
      table (decision 15, section.kind reference_appendix,
      excluded_from_fact_tables true, Ben's #19), yet fact-conclusions'
      tablesForFamily offered it to the extractor and validated readouts
      against it, which is how 45 facts named it. Decision from that
      evidence: it is a retired key for readouts. fact-conclusions skips
      excluded sections in tablesForFamily and findTableByKey, so the
      extractor's table_shapes for KEY_DEFINED_TERMS no longer carry it
      and a readout naming it fails validation and is dropped with the
      CONCLUSIONS_DROPPED note, the fact kept, as finding (37)'s retired
      tables are; on the page the readout was already treated as none.
      And a fact collectDefinitionFact takes into Defined Terms is never
      listed under a section as without a readout (collectDefinedTerms
      returns whether it took the fact). (c) A column's
      code_from_words_by_row (row -> [{ code, words }], validated against
      the row's codes) codes an empty vocabulary cell on the page from the
      fact's own words, first rule that matches; both Board determination
      standard rows carry the four rules, "reasonably likely to be
      inconsistent" before "inconsistent" alone (the stricter reading),
      then "violate" and "required by"; the cell is marked derived:
      'code_from_words' and cites the words that named the code; a code
      the model returned is never overwritten. Both tables' guidance now
      asks for the code every time, naming the mapping. Found underneath
      it: a presence-derived column (the intervening and superior tables'
      provision column, derived on their termination rows alone)
      overwrote every row's cell with a dash at render, so a code the
      model returned on the intervening table's other rows never showed;
      rows outside derived.rows now keep their cells (asserted). (d) The
      six facts: the core table gains the fixed row "Permitted contact:
      clarification and the no-shop's terms" (Yes / No, coded Yes from
      the words) for the clarify and the no-shop's-terms permissions; the
      change-of-recommendation table's Not a Change of Recommendation row
      gains DISCLOSURE_REQUIRED_BY_LAW and
      DISCLOSURE_PERMISSION_NOT_A_CHANGE beside the stop-look-and-listen
      and factual-statement codes, taking the required-by-Law permission
      (EXCEPTION_PREREQUISITE) and the no-change sentence
      (RECOMMENDATION_CHANGE); the negotiation with a Qualifying Company
      Takeover Proposal is the Engagement standard row; the takeover-
      statute carve-out is an Other provisions entry of the change table
      through a new table field other_provisions_from_subtype (subtype
      keys and a words gate; such a fact is never a row). The page
      defaults are fact_type_rows with fact_type_rows_when, which now
      takes one gate per fact type (a fact type without a gate in that
      form takes no default from the table), the gates disjoint across
      the no-shop tables so defaultConclusions finds one candidate. The
      NO_SHOP layer rules name the six as facts of their own with their
      rows. The proposed row label, the two codes and the word gates are
      the implementer's; Ben or the manager adjust. Tests: fact-
      conclusions (the deeming forms, the ambiguity, the note, the
      appendix not offered), table-view (5.02(e) through the page,
      Defined Terms only, the codes from words on both tables with the
      derivation and the non-overwrite, the six facts on their rows and
      the other provision, nothing unplaced), table-shapes (the fields,
      the gates, the codes, the layer rule, four validation codes).
      Generation 8's stored facts take the rows and codes on the next
      page render; no re-run. npm run test:active: 669 tests, 668 pass,
      the one failure the known Codex-client final-message test.
      (60) 2026-10-18 (implementer), work package 8 on the manager's
      message of 06:33 UTC. (1) The page re-reads a stored value cell
      from its cited words: in table-view's contract cells, a value cell
      whose cited component parses under the current parser to a value
      other than the stored canonical shows the parsed value, with
      reparsed: true and stored_value beside it (the table cell carries
      data-reparsed and the title "Re-read from the cited words; the
      stored number differed", for the sidebar to pick up); a cell whose
      cited words do not parse keeps the stored value. Asserted with the
      "deemed two (2) business days" component (stored 4, shown 2
      business days), a plain "four (4) business days" (unchanged, not
      marked) and unparsable words (stored value kept). The manager's
      gen8-preview.json is on the manager's side; the fixture here is
      the same shape of fact, and the row reads 2 business days through
      buildTableView and the rendered table; please confirm on the
      preview. (2) 8.02(a)'s willful-breach definition: a KEY_DEFINED_TERMS
      fact whose readout lands on no row (an unknown or retired table, a
      table of a section without the family, or a row a fixed-list table
      without open rows does not have: readoutLandsOnRow) has its readout
      treated as none in applyPageRules, so collectDefinitionFact takes
      it as a Defined Terms entry (term from the quoted name, definition
      the summary) and it is on no row and in no without-a-readout list;
      asserted for all three cases, and a readout on a row the shapes
      have is kept. (3) The sandbox session: @vercel/sandbox 3.2.1's
      Sandbox.get takes a name and resolves credentials (a token with
      team and project, else the deployment's OIDC token) for every call,
      and sets no identity or credential inside the sandbox, so the
      worker cannot extend its own session without carrying a Vercel
      credential the launcher deliberately keeps out of it (it unsets
      every credential but the provider's). So the route: POST
      /api/product/analysis/<run>/run with { keepalive: true } (same
      origin or the internal bearer, as any run call) resumes the named
      sandbox and extends its session back to MINIMUM_SESSION_MS (four
      hours) when it has less, launching nothing; it answers 200 with
      { keepalive: { session_created_at, remaining_before_ms,
      extended_ms, remaining_after_ms } } and 503 PRODUCT_SANDBOX_GONE as
      the wake does. The monitor pattern: call it on each check (every
      check, since a check is well under four hours apart), before
      reading the run; a wake is still what starts a worker. Nothing in
      the worker changed. The launcher's flock: `exec flock --wait 3600
      --conflict-exit-code 75 .../pm-worker.lock` runs the one worker
      command, so a wake that finds a live worker waits on the lock
      (never a second worker beside it; after an hour it exits 75, and a
      queued wake runs when the live worker ends, finding the run READY
      or the sections it left); asserted on the launcher text. Not done:
      an in-worker extension, for the reason above. Tests: table-view
      (the three value cases; the three no-row cases and the kept one),
      provision-tables (the rendered marker), sandbox-worker-scripts
      (keepalive's extension, the no-extension case, the gone sandbox,
      the route action with no wake, the launcher's lock). npm run
      test:active: 675 tests, 674 pass, the one failure the known
      Codex-client final-message test.
      (63) 2026-10-18 (implementer), work package 9, begun on finding
      (62)'s terms and reconciled to the manager's message of 08:05 UTC
      (received after the first push; the reconciliation is the second
      push). The split: longSectionGroups splits a section only with
      min_children (3) operative children, so 9.03, the definitions
      section with no lettered limbs, went as one call in every
      generation. agreement-draft.js gains limblessSectionParts: when a
      section is at least min_section_bytes and has fewer operative
      children than min_children, its paragraphs (the residual pass's
      paragraph spans, residualParagraphSpans, already in the section's
      span inventory) are grouped in source order into parts of at most
      group_bytes (3,500), each paragraph whole in exactly one part (a
      paragraph larger than a part stands alone); two or more parts
      split, else the section goes whole. Each part carries its
      paragraphs as source_closure.operative (kind RESIDUAL_PARAGRAPH,
      the words), extraction_part.mode "paragraphs", and a part
      instruction saying the section has no limbs, each paragraph (so
      each definition) is whole in one part, and "definitions in other
      parts are extracted elsewhere, cite them as context only"; part 1
      carries covers_chapeau (its first paragraph is the opening words;
      the limb instruction about the chapeau span is not sent) and the
      issue records chapeau_in_part 1; the parts merge as the limb parts
      do under the same part identity (attempt token :part-n), the
      quotes resolve against the paragraph spans, and the
      LONG_SECTION_SPLIT issue records the mode. The limb split and
      LONG_SECTION_SPLIT's numbers are unchanged. The cap, independent of
      the split: attempt 1 timed out rather than failing on the cap
      because the cap only showed at the result event (text_blocks > 1
      in validateResponse); after the model resumed with a second object
      it kept generating until the 30-minute clock. The Claude CLI client
      now watches the stream as it arrives (runProcess takes an
      abortWhen): a second assistant text block that begins a top-level
      answer object (a block starting `{"proposals"`, `{"resume_note"`,
      ... after one already did; a block that merely continues the one
      object, as the thinking-interleaved streams do, is not one) is the
      cap, and the process is stopped at once with
      CLAUDE_OUTPUT_TRUNCATED naming the characters of text, the text
      blocks and the last output-token count the stream reported
      (outputCapReason), seconds after the second object begins. Every
      Claude CLI failure reason (the cap, a timeout, a malformed answer)
      now ends with the section and its size from the request
      ("[section 9.03: 61,042 bytes, 0 operative spans, part 2 of 5]"),
      and a timeout's message carries what had arrived ("received before
      the failure: N stream events, M text blocks, K characters of text,
      T output tokens reported, no result event";
      summariseReceivedClaudeOutput, lenient on a half-written last
      line); the recorded provider failure keeps the same summary beside
      the raw output. Tests: Concho 6.1 (14k bytes, two operative spans)
      splits by its paragraphs, every paragraph once in order, parts
      within the usual size; a limbed section never takes the paragraph
      split; the section draft on 6.1 is built in paragraph parts with
      the synthetic model (routing, residual, one call per part, one
      proposal per part quoting its paragraph, part 1's covers_chapeau,
      the mode and chapeau_in_part in the issue); the summary on a
      partial stream with the token count; a continuation block is not a
      second answer; a fake claude that streams two events and hangs
      times out with the summary in the message; a fake claude that
      begins a second answer object fails as the cap within seconds of a
      20-second timeout; the product model names the section and its
      size on a cap failure and on a timeout; product-extraction-
      recovery: on Concho 6.1's paragraph parts, a part whose proposal
      cites words absent from the section holds that proposal alone
      (UNKNOWN_SOURCE_COMPONENT) while the other parts' proposals stay
      VALID. The worker update, the 9.03 retry (POST /run retry) and the
      wake are the manager's; the run was not touched. Suites outside
      test:active run directly: product-long-section-split and
      product-extraction-recovery together 21 of 21, product-claude-cli-
      provider 11 of 11. npm run test:active: 676 tests, 675 pass, the
      one failure the known Codex-client final-message test.
      (67) 2026-10-18 10:43 to 11:40 UTC (implementer), work package 10
      on the manager's message of 10:40 UTC: the prompt-cache breakpoint
      for the ANTHROPIC_API provider. No run submitted; no live API call;
      no key value anywhere. Evidence read first: the adapter (one user
      text block holding the request JSON), the three request builders,
      the price table, and generation 8's 313 stored calls on the preview
      branch (run 72d94dd2), parsed from their recorded requests.
      Profile: extraction 130 calls, 9,617,201 input tokens, of which the
      part that is a function of the schema and the routed family set
      alone (instruction, scope_instruction, family_contracts,
      cross_section_target_contracts, response_contract with its per-set
      allowed maps, component_instruction with the layer rules,
      table_shapes, conclusion_instruction) is 3,949,927 tokens, 41 per
      cent; the source closure, the part instruction and the two
      section-specific instructions are the rest. 40 distinct routed
      family sets over 83 sections; 90 of the 130 calls repeat a set.
      Routing 93 calls, 948,288 input, stable (instruction, the 25
      family routing contracts, response contract) 718,691 tokens, 76 per
      cent, one set. Residual 90 calls, 312,860 input, stable about 930
      tokens a call (1,626 bytes), 27 per cent. Durations: extraction
      median 217 s, p90 450 s, max 1,800 s; a worker's next extraction
      starts a median 233 s after its previous one started (52 of 126
      per-worker gaps over five minutes; four worker ids ran). Built:
      `lib/product/anthropic-api-model.js` sends every request as two
      text blocks in one user message, the stable block (call kind, prompt
      version, then every request key not named in PER_SECTION_KEYS for
      the call kind: ROUTING section_reference, section,
      deterministic_family_evidence; RESIDUAL section_reference,
      routed_families, paragraphs; EXTRACTION source_closure,
      part_instruction, article_introduction_instruction,
      no_other_reps_instruction) carrying `cache_control: { type:
      'ephemeral', ttl: '1h' }`, then the section block; the system prompt
      gains one sentence (REQUEST_LAYOUT_NOTE) saying the request is two
      JSON objects to be read as one. Decision: the cache is keyed per
      routed family set, identical content to today; the whole schema's
      contracts in one entry for every section would have added about
      180,000 tokens of contracts the model was not routed to on every
      call (the 25 contracts and the 30 table shapes together are 418 KB)
      and changed what it reads; not taken. What the model reads is the
      same words in a new order (the closure now follows the contracts)
      plus that sentence, so the prompt versions stay. The minimum
      cacheable prefix is 512 tokens for claude-opus-5
      (platform.claude.com/docs/en/build-with-claude/prompt-caching, read
      2026-10-18: "Shorter prompts cannot be cached, even if marked with
      cache_control ... processed without caching, and no error is
      returned"); the residual pass's stable block is above it on the
      estimate, so all three call kinds get the breakpoint; if it falls
      short the API ignores it at no cost. The lifetime: the documentation
      says it "is measured from the start of the request that writes or
      reads the cache entry, not from the end of its response", and the
      entry is refreshed on every read. On generation 8's gaps between
      consecutive calls of the same routed set (any worker), the 5-minute
      entry ($6.25 per million written) would be read by 45 of the 90
      repeat extraction calls, 69 of 92 routing, 66 of 89 residual:
      writes 3,185,992 tokens, reads 1,566,424, input $51.33 against
      $54.39 uncached, saving $3.07 a generation. The 1-hour entry ($10
      per million) would be read by 85 of 90, 91 of 92, 88 of 89: writes
      1,552,709, reads 3,199,707, input $47.76, saving $6.64. Chosen: 1
      hour, `ANTHROPIC_API_CACHE_TTL` in product-model-config.js with the
      arithmetic in its comment. Caveat on the hit rate: an entry is
      readable only after the writing request's first response begins,
      so two workers starting the same routed set within an extraction's
      thinking time both write; the 85 of 90 is an upper bound. Recording:
      the stored call's request is the request as sent, blocks and all;
      its response is the message as received, whose `usage` carries
      `cache_read_input_tokens`, `cache_creation_input_tokens` and the
      `cache_creation` breakdown by lifetime beside `input_tokens`, which
      stays the whole prompt (the call body itself is unchanged: a new
      field would change every model_call_id and the finalisation's
      identity check reloads calls from the fixed columns).
      `anthropicApiCostMicrousd` prices writes from that breakdown, else
      at the lifetime asked for. `scripts/product/estimate-run-cost.js`
      takes `--cache-write-tokens`, `--cache-read-tokens`, `--cache-ttl`
      (replacing the guessed `--cache-read-share`), or with `--run` reads
      the split from the stored calls' responses per call kind, and prints
      the uncached total beside the estimate. The NCS estimate on
      generation 8's profile (10,878,349 input, 3,623,975 output):
      uncached $144.99 ($54.39 input, $90.60 output); with the cache at
      the design's 1-hour hit rate $138.36; at the 5-minute rate $141.92.
      Repository evidence against finding (46)'s "about $97 if two thirds
      of the input read from cache": the input that repeats is 44 per
      cent, not two thirds (the closure is 59 per cent of an extraction's
      bytes and never repeats), and output tokens are 62 per cent of the
      bill and cannot be cached. The honest expectation is a saving of
      about 4.6 per cent; the API run's real reason stays what (50) said,
      preserving the subscription. Generation 8 ran 10 per cent more
      input and 15 per cent more output than generation 7 ($127.93).
      Proposed, not done: Ben's $200 covers one NCS generation and a
      retry at these rates; a second deal does not fit. Tests
      (`tests/product-anthropic-api-provider.test.js`, 13 of 13): the
      block structure per call kind and the one-block case, the stable
      block byte-identical across Concho 6.11 and 6.13 through the real
      builders with the V2 schema and the V3 table shapes (routing,
      residual and extraction each; the section block differs; the
      extraction's stable block carries NO_SHOP's contract and table
      shapes and no closure), the cost arithmetic by lifetime, the
      recorded shape, the estimate script's flags, generation 8's three
      estimates, and the split read from stored rows. CLI paths untouched.
      npm run test:active: 679 tests, 678 pass, the one failure the known Codex-client final-message test. To submit NCS on the API, in order:
      `node scripts/product/update-sandbox-worker.js` (the sandbox to this
      branch's tip, after the merge), a redeploy of the branch so the run
      route reads the new code and ANTHROPIC_API_KEY, then
      `PRODUCT_INTERNAL_TOKEN=... node scripts/product/start-generation.js
      <base-url> <ncs-sec-url> <generation> --provider ANTHROPIC_API`;
      afterwards `SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... node
      scripts/product/estimate-run-cost.js --run <run-id>` prices the run
      from its own cache reads and writes. Commits 33540c0 (code and
      tests) and the plan and guide commit.
      (70) 2026-10-18 11:58 to 12:25 UTC (implementer), work package 11
      on the manager's message of 11:55 UTC (the message asked for a
      finding (69); the manager's own (69) already records the refusal,
      so this is (70)). No run submitted or retried; no live call; no
      key or workspace id value anywhere. The refusal, verbatim from the
      manager's log of run 51577c57: 400 invalid_request_error, "This
      API key is not scoped to a workspace, so this request must include
      the anthropic-workspace-id header with the ID of the workspace to
      use. Add the header, or use an API key that is scoped to a
      workspace." Built: `lib/product/anthropic-api-model.js`
      `clientOptions` gives the Anthropic client `defaultHeaders:
      { 'anthropic-workspace-id': <id> }` when ANTHROPIC_WORKSPACE_ID is
      set (trimmed; an empty setting is no setting) and nothing when it
      is not; the option is the SDK's own (@anthropic-ai/sdk 0.78.0,
      client.d.ts: "Default headers to include with every request to the
      API"). The id takes the key's path: `run-handler.js` reads it from
      the deployment (`anthropicWorkspaceIdResolver`), the wake passes it
      to the sandbox command's env as ANTHROPIC_WORKSPACE_ID beside
      ANTHROPIC_API_KEY for the API provider only, `launch.sh` unsets
      both for every other provider and requires only the key, the
      worker requires nothing new and the model reads the id from its
      environment; no code path prints it. A 400 whose message names the
      header is `ANTHROPIC_API_NOT_CONFIGURED` (the API's message kept,
      the error saying whether the header was sent), and
      `scripts/product-hosted-worker.js` stops on it with
      PRODUCT_HOSTED_ANTHROPIC_API_NOT_CONFIGURED the way it stops on a
      usage limit, so a misconfigured key costs one call, not three
      attempts of every section. What Ben sets on the Vercel project,
      one of: ANTHROPIC_WORKSPACE_ID (the workspace's id from the
      console) beside the existing ANTHROPIC_API_KEY, or a key created
      inside a workspace replacing ANTHROPIC_API_KEY; then a redeploy
      (the run route reads the variable) and `update-sandbox-worker.js`
      before the manager retries 51577c57. Tests (no live call):
      `tests/product-anthropic-api-provider.test.js` the header present
      when configured, absent when not, and read from the environment;
      the 400 as ANTHROPIC_API_NOT_CONFIGURED with the message kept and
      not matching the usage-limit rule; the wake's env carrying the
      variable by name and the result never carrying the value; the run
      route's resolver. `tests/product-hosted-worker-pool.test.js` the
      worker stopping on it. `tests/product-sandbox-worker-scripts.test.js`
      the launcher's unset line and no requirement. npm run test:active:
      682 tests, 681 pass, the one failure the known Codex-client
      final-message test. Guide line updated. Commit: the code and tests, then
      the plan and guide.
      (71) 2026-10-18 13:10 UTC: work package 11 (finding (70)) accepted
      and merged (d82723e8, a fast-forward; its 36 tests across three
      files pass here; its suite 681 of 682 with the known failure); the
      sandbox worker at d82723e. Ben, 12:58 UTC: "the api key I made was
      for the full org, what is wrong with that?" Nothing with the key:
      the API requires a request made with an organisation-level key to
      name its workspace in the anthropic-workspace-id header. Ben,
      13:09 UTC: "done will be live on next redploy": ANTHROPIC_WORKSPACE_ID
      set on the project (all environments, 13:08 UTC) beside the key.
      This push is the redeploy the run route needs; then run 51577c57
      is retried (ncs-gen5-retry-1) and woken.
      (72) 2026-10-18 13:12 UTC: retried (ncs-gen5-retry-1) on the
      redeployed alias (b779328c) and FAILED again in a minute, zero
      tokens: 400 invalid_request_error "anthropic-workspace-id header
      must be a valid workspace ID." (req_011Cg9m1ecRhm2xz3J2vTdi7). The
      value set is not a workspace id; Ben asked for the id shown on the
      workspace's own page in the Console. Second defect, the
      implementer's (work package 11b): the ANTHROPIC_API_NOT_CONFIGURED
      error was raised with the right message but the section attempt
      loop retried it three times per section and failed the run before
      the worker's stop saw it; the fix stops the worker at the first
      call and leaves the run resumable by a plain wake.
      13:24 UTC, Ben: "fixed" (ANTHROPIC_WORKSPACE_ID replaced); this
      push redeploys the alias and the run is retried (ncs-gen5-retry-2).
      (74) 2026-10-18 13:40 UTC: ncs-gen5-retry-2 ran on the API. The key
      and workspace id are accepted; the cache breakpoint works as
      designed (1.1's routing call wrote 8,198 tokens to the 1-hour
      entry, 1.2's second routing attempt read the same 8,198; the
      residual entry 1,029 written then read; 1.1's extraction wrote
      17,628). 1.1 completed (19,600 input, 7,577 output, $0.38 for the
      extraction). 1.2 (the Tolling Period blackout on Closing) failed
      its three attempts in a minute on RESIDUAL_FAMILY_CONSISTENCY: the
      residual pass answered UNRESOLVED_UNUSUAL_PROVISION and named the
      families the paragraph sits near (MERGER_STRUCTURE_CLOSING,
      TERMINATION), the same answer each time, and the rule treated any
      family on a non-KNOWN_FAMILY disposition as a contradiction though
      the response contract never says a family needs KNOWN_FAMILY.
      Fixed in code for every run: a known family with no family is
      still a contradiction; an unusual or immaterial paragraph keeps
      the families it names, on the disposition and in its issue ("...
      (near MERGER_STRUCTURE_CLOSING, TERMINATION)"), and the routing is
      not widened by them (widenRoutingFromResidual reads KNOWN_FAMILY
      only). The worker updated; the run retried (ncs-gen5-retry-3).
      Work package 11b (the configuration stop) is still with the
      implementer; its merge follows.
      (75) 2026-10-18 14:05 UTC, plan state. Ben: "the api looks very
      expensive vs just using subscription!"; "agree with all"; on the
      assessment and ETA, "ok". Decisions recorded: NCS generation 5
      finishes on the API; Olaplex and Apogee run on the subscription,
      back to back, each read while the next runs; Ben's UI comments go
      to the implementer in parallel (work package 12); the ETA to the
      Phase 6 exit is five to seven working days with Ben's live deal.
      Phase 5B's boxes ticked on the evidence, each long live: 5B.2 the
      V2 schema is the active schema (LEGAL_SCHEMA/V2.0 on every
      generation since Metsera 4; Ben's 5B.2a check); 5B.3 prompt V7
      with the component tree and layer rules is the extraction every
      run makes (product_model_calls prompt_version); 5B.5 the published
      reader on layers is components/product/PublishedSummary.jsx; 5B.4
      the review page renders through it with the decision buttons and
      component-level edits (lib/product/review-state.js); 5B.6 NCS
      under V2 ran as generations 2 to 4 and generation 5 is running;
      5B.8 the table shapes and coded conclusions are contracts/product/
      table-shapes.v3.json on the provisions page; 5B.7 Metsera under V2
      is generations 4 to 8 with their audits (an exposed check, as the
      item says, not blind evidence). Still open on the road to done:
      Phase 5's sample reconciliation and measure (after Olaplex and
      Apogee), Q5 and Q4, Phase 6.
      (77) 2026-10-18 14:35 UTC: NCS generation 5 FAILED again at 7 of
      104 ($3.62 spent): two split sections (nodes 559082cf, 6d802d00)
      failed three attempts each on "DATABASE_ERROR: invalid product
      model invocation identity" after their routing, residual and first
      extraction part had been paid for. Cause in the store, not the
      model: the admission rule's part reader
      (product_phase2_model_call_extraction_part) read messages[0].content
      as one JSON string; the API provider's two-block layout (work
      package 10) makes it an array, so the part number was never found
      and the expected identity was derived from the bare attempt token.
      Migration 20261018143000_product_model_call_part_identity_blocks
      walks a content array, each text block parsed as JSON and searched
      for source_closure.extraction_part (top level or under request);
      a string content reads as before. Applied to the preview branch
      and verified on four shapes (blocks with a part: 2; string with a
      part: 3; blocks without a part: null; a block that is not JSON:
      null). Work package 11b (the stop at a configuration refusal)
      could not have caught this: a store refusal after paid calls is a
      section failure by design. Retried (ncs-gen5-retry-4).
      (73) 2026-10-18 13:21 to 13:50 UTC (implementer), work package 11b
      on the manager's message of 13:17 UTC. No run retried; no live
      call. The gap, read in the live path: the worker's loop calls
      `advanceAgreementDraftAnalysis` (lib/product/analysis-runner.js),
      whose section loop catches every error from the attempt, records
      the failure (the section FAILED with attempts n, the run PARTIAL
      while n is under max_attempts) and returns the analysis; the
      worker sees PARTIAL, loops, and the claim takes the same section
      again (attempts n+1) until the third failure makes the run FAILED
      and the worker throws PRODUCT_HOSTED_RUN_FAILED. Neither stop rule
      in scripts/product-hosted-worker.js ever saw the error: the
      not-configured stop of (70), and the usage-limit stop before it,
      which had the same gap (a limit mid-run burnt three attempts a
      section the same way; the earlier tests stubbed `advance` to throw,
      a path the live worker does not take). Fix, in code for every
      hosted run: `lib/product/worker-stop.js` is the one test
      (`workerStopReason`: ANTHROPIC_API_NOT_CONFIGURED to
      PRODUCT_HOSTED_ANTHROPIC_API_NOT_CONFIGURED; the usage-limit rule
      to PRODUCT_HOSTED_CODEX_USAGE_LIMIT, the code keeping its name);
      the section loop records the one attempt and then rethrows a stop
      error instead of returning; the worker's catch names the exit
      reason from the same test. State after the stop: the section
      FAILED with the reason on its row and attempts 1, the run PARTIAL,
      the other sections PENDING and untouched. PARTIAL, not RUNNING or
      PENDING as the message asked: the claim counts the attempt before
      the call is made and the only ways to release a claimed section
      (product_phase1_fail_section, the lease expiry) end it FAILED; a
      plain wake resumes a PARTIAL run (the claim refuses only FAILED
      and READY runs and takes FAILED sections with attempts to spare),
      which is what the message wanted. Proposed, not done: a release
      RPC that returns the section to PENDING with the attempt refunded
      would need a migration on the preview branch; the one spent
      attempt out of three did not seem worth it. Tests
      (`tests/product-hosted-worker-pool.test.js`, 14 of 14), through
      the real section loop with an in-memory store that keeps the
      database's claim and failure rules and the Concho fixture: the
      refused configuration makes one call (the first routing call), one
      claim, one recorded attempt with the reason, the worker exits
      PRODUCT_HOSTED_ANTHROPIC_API_NOT_CONFIGURED with the API's message,
      the run is PARTIAL and every other section PENDING with no
      attempt; a session limit stops the same way; an ordinary section
      error is still claimed to three attempts and then fails the run;
      the reason table. Also repaired here: the manager's (71) and (72)
      were inserted inside (70)'s last sentence; the sentence is joined
      again. npm run test:active: 685 tests, 684 pass, the one
      failure the known Codex-client final-message test. Guide line for
      analysis-runner.js updated.
      (76) 2026-10-18 14:22 to 15:05 UTC (implementer), work package 12
      on the manager's message of 14:15 UTC: Ben's six comments on the
      provisions page, each read against the page as it is today and
      against Metsera generation 8 (run 72d94dd2; its 961 layered VALID
      facts rebuilt through `buildTableView` from the stored rows) and
      the NCS run (51577c57, 7 sections and 23 facts complete at the
      time). Four of the six were answered in work package 2 (findings
      (43) and (47)) and hold; two are new code here. No extraction or
      stored data changed; the NCS run not touched.
      1. "when I clicked 'see provision' on 'definition' in 'intervening
      event mechanics' the main body of the page leapt around, it should
      stay static and the left hand side should just come up." Answered
      in (43): the sidebar is fixed to the viewport and comes up over the
      page; the content column keeps one width whether or not a fact is
      selected (tests/product-provision-tables.test.js "the content
      column keeps its width when a selection opens the sidebar"). Read
      again today: no scrollIntoView and no layout change on the
      provisions page or in EvidenceSidebar / ProvisionTables (the one
      scrollIntoView in components/product is SourceContextPanel's, used
      by the review workspace, not this page). Nothing to change.
      2. "in the right hand side bar - I like interpretation tree,
      'provision' - should that read as How Corpus Interpreted (or
      something better sounding!) and then 'clause' - what is that? The
      full section it comes from? Be clearer?" Answered in (43):
      "Interpretation Tree" stays; "Provision" is "How Corpus read it";
      "Clause" is "Source text · Section 5.02(f)" with the note "The full
      section these words come from, as drafted; the cited words are
      marked." and the tab "Source text". For Ben's decision, the
      wordings the code can carry (one constant each in
      EvidenceSidebar.jsx): words block "How Corpus read it" (built) or
      "Corpus's reading" or "What Corpus read"; section block "Source
      text · Section 5.02(f)" (built) or "Section 5.02(f) in full" (the
      manager's example) or "Section 5.02(f), as drafted". The code keeps
      (43)'s until he chooses.
      3. "Also look at this one, not formatted very prettily and also
      random page breaks and page numbers...!" Answered in (43):
      `lib/product/source-display.js` `hidePageFooters`, a deterministic
      rule (a line that is only a page number or a front-matter roman
      numeral, with the blank lines around it; a break at a sentence end
      or before a new limb keeps one paragraph break, mid-sentence it is
      a space; a hyphenated word or an inline "-5-" is left alone),
      display only, never on the stored text or spans; its own unit test
      in tests/product-table-view.test.js and the sidebar test "the SEC
      page footers in a cited run of words are hidden in the sidebar
      words and clause, with the marks still in place"; the section
      renders as paragraphs with lettered limbs indented. Nothing to
      change.
      4. "why do we have a summary column here? Also 'period' as a
      column is wasteful as it only applies to one provision? Consider
      that point generally?" New, general, in `lib/product/table-view.js`
      `pruneEmptyColumns` after the fold and pill rules of (43): a
      column with no filled cell on any line of a table in this run's
      output is not rendered, whatever it renders, and is named on the
      table (`hidden_columns`, with its header and reason); an as-drafted
      (fact_text) column whose every filled cell is the line's own label,
      or empty, is not rendered; the Other provisions table renders its
      Summary column only when some line's summary says more than its
      term (ProvisionTables `summarySaysMore`). On generation 8 the
      rule removes: Period on the general IOC terms (empty on all 3
      rows), Vote Standard on the stockholder meeting table (0 of 6) and
      on the conditions table (0 of 6), Summary and Threshold on the tail
      fee table (0 of 1), Summary on the tax matters table (0 of 1); no
      as-drafted column repeats its labels on that run, so none is
      removed for that reason. On the NCS run so far: Exercised By,
      Outside Date, Extended To, Written Consent and Vote Threshold on
      the mutual termination table (its one row fills only the as-drafted
      cell). The "Summary" Ben saw is the `provision` vocabulary column's
      header on seventeen tables (the no-shop notice table among them):
      a column of code pills called Summary. With codes hidden (point 5)
      it shows the words read; the header is still misleading. Proposed
      for Ben, not done: rename that header to "Provision" (or
      "Reading") in scripts/product/table-shapes-decision-34.js and
      regenerate; one line, every deal.
      5. "odd under ongoing updates to have required within a stated
      period and required promptly. Also weird to have the 48 hours
      there. I know the pills are likely helpful for background
      comparison work etc but do we need to show them here? Consider
      this more generally on the UI pills etc." New: every coded cell
      carries the words it was read from (`attachWords`: the cited
      components' text in the cell's order, page footers hidden, cut to
      one short line of 90 characters), and the page has one setting,
      `SHOW_CODES_BY_DEFAULT` in table-view.js, false. With codes hidden
      a coded cell shows its words in the body face and still opens the
      sidebar (the code label on the title); a folded trailing detail
      shows its words; a cell with no cited words (a default, a presence)
      keeps its label; values and as-drafted text are words already.
      "Show codes" in the section-toggle row brings the pills up
      page-wide ("Hide codes" to put them back). The pills stay in the
      data and on Query. Proposed default for Ben: codes hidden (words
      first), as built; the alternative is one constant. On the notice
      table's Ongoing updates row this reads the two facts' own words
      ("promptly (and in any event within 48 hours)…" and the
      material-terms words) instead of "Required within a stated period"
      and "Required promptly" beside "48 hours".
      6. On the 2.01 Consideration package tree: "hitting 'show detail'
      doesn't add much...just same stuff again? Also, we should better
      indent the (i) and (ii) for the right to receive that is shown."
      Answered in (47): a parent whose children cover its words shows the
      children in its place with no control; "Show detail" appears only
      from the fourth level, on a parent whose own words stand above
      children not yet shown, so it never repeats what is on the line;
      list elements (i), (ii), (A), (B) are separate indented lines with
      their markers (tests "the sidebar tree shows a covered parent as its
      indented children, a parent's own words above its children, and
      folds only from the fourth level"). Nothing to change.
      Tests: tests/product-table-view.test.js (three tests that expected
      a dash in a never-filled column now expect the column hidden and
      named), tests/product-provision-tables.test.js (the default and the
      toggle, the words on cells and trailing details, the pruning rule's
      cases and the rendered headers, the Other provisions Summary rule;
      the pill tests open with the codes shown). Suites: table view,
      provision tables, provisions preview and published layers 122 of
      122 together; npm run test:active: 689 tests, 688 pass, the one
      failure the known Codex-client final-message test. Guide line updated.
      Commit af97f4e (code and tests), then the plan and guide.
      (78) 2026-10-18 15:10 UTC: work package 12 (finding (76)) accepted
      and merged (c4b3cfe6, a fast-forward; the table-view and
      provision-tables suites 107 of 107 here; its suite 688 of 689 with
      the known failure). Four of Ben's six points were already answered
      by work package 2 and hold on a re-read; two are new code: a
      column no row fills is not rendered and is named on the table, and
      the coded pills sit behind one page-wide "Show codes" control with
      the cited words first. Put to Ben for decision: the sidebar
      wordings ("How Corpus read it"; "Source text · Section 5.02(f)"),
      the codes-hidden default, and renaming the `provision` column's
      "Summary" header. NCS generation 5 at 15:05 UTC: RUNNING, 14 of
      104, no failure since the retry, $16.40 spent; the worker alive.
      (79) 2026-10-18 16:40 UTC, NCS generation 5 read at 31 of 104
      ($46.35 spent, 356 proposals, 344 VALID, 12 held; the projection
      now about $155, Ben told at $137 and warned of the $170 line).
      Read against the text: 1.1 (the merger, Merger Sub's existence
      ceasing, the Company surviving as Parent's wholly owned
      subsidiary) right; 1.2 right in substance (the second Business
      Day Closing at 10:00 a.m. Central, Baker Botts, remote closing,
      the Tolling Period blackout, the day-for-day Outside Date
      extension and the no-termination clause on the mutual termination
      table's Outside Date row); 2.1's election economics extracted
      (Cash Exchange Ratio 0.1371, Share Consideration Exchange Ratio
      0.5537, Mixed Share Consideration Exchange Ratio 0.2392, Parent
      Closing Price, the Section 368(a)(2)(E)(ii) cash cap on the Tax
      Matters table, Default Stock, the Rewind no-adjustment clause).
      Three defects, two shared with generation 8, handed to the
      implementer as work package 13:
      (a) 3.4 (Authority) is all held, 10 of 10, and generation 8's
      3.19 was the same class: every component the model cut from the
      Article III introduction (origin INTRO: "the Company represents
      and warrants to Parent and Merger Sub as follows:" and the
      Except-as-set-forth qualifiers) cites span 3d0f0a06..., which does
      not exist; the closure's chapeau span is 3d0f7a06... (one
      character apart) and holds every quote verbatim. The component
      compiler reports UNKNOWN_SOURCE_COMPONENT and holds the fact. A
      quote found verbatim in exactly one closure span of a kind its
      origin allows is relocated to that span with a note, as sibling
      relocation already does; the id the model wrote is evidence of
      what it read, not the fact.
      (b) The Defined Terms fallback takes non-definition facts whose
      tree carries a DEFINED_TERM component and shows an arbitrary
      component as the definition: 1.2's "Closing may not occur during
      the Rewind Tolling Period" is a Defined Terms entry "Tolling
      Period: shall not occur on any date that falls on..." and "The
      date the Closing occurs is the Closing Date" an entry "Closing
      Date: is referred to in this Agreement as"; 2.1's Default Stock,
      Rewind and Share Election Stock facts likewise. A fact enters
      Defined Terms only when it is a definition (KEY_DEFINED_TERMS, or
      a DEFINED_TERM component that resolves to its definition) and the
      entry's text is the definitional words; any other readout-less
      fact stays under its family's table "without a readout".
      (c) The consideration tables carry the election type (Mixed
      election) and the mechanics rows but no per-share economics: the
      three exchange ratios and the cash value sit in Defined Terms
      while the consideration-components table shows "Stock election"
      and "Acquirer stock" rows with no ratio or value. The shape needs
      the election options as rows (cash election, share election,
      mixed election: ratio, cash, value per share) filled from the
      facts, with a value fallback from a defined ratio that carries
      a number; proposed to Ben with the rows once built.
      Also seen: 76 CONCLUSIONS_MISSING notes over 31 sections (the
      extractor gave no readout), against 92 over generation 8's 85;
      the rate is up and is watched on the next read.
      (80) 2026-10-18 16:50 to 17:06 UTC (implementer), work package 13
      on finding (79)'s three defects. No run submitted; no live API call;
      no key value anywhere. (a) The unknown span. The held components of
      NCS 3.4 and Metsera 8's 3.19 cite a span id one character off the
      chapeau span that holds their words. `resolveEvidenceQuote`
      (lib/product/agreement-draft.js) now takes a quote on a span the
      closure does not have from the one closure span of a kind its origin
      allows (INHERITED_SPAN_KINDS: CHAPEAU and INTRO to the chapeau spans,
      DEFINITION to the definition spans) in which the quote is verbatim,
      records `unknown_span_resolved_from` and the span's kind on the
      component, and the compiler reports one COMPONENT_SPAN_RELOCATED note
      per proposal listing the quotes moved; two candidate spans, or none,
      stay UNKNOWN_SOURCE_COMPONENT and the fact stays held; own words
      still resolve through the section alone. The id the model wrote is
      kept as evidence. (b) Defined Terms. `definedTermParts`
      (lib/product/table-view.js) reads a DEFINED_TERM component's
      resolves_to words as its definition before the inline guess from its
      parent or neighbour and says which it used (`source`); a
      non-definition fact enters Defined Terms only through a component
      that resolves to its definition (source resolves_to or a "means"
      sentence), and an inline guess alone adds no entry, so 1.2's Tolling
      Period and Closing Date read their definitions and a fact whose term
      the model did not resolve stays under its family's table. On the
      stored 2.1 facts the entries Default Stock, Share Election Stock and
      Rewind remain because the model resolved them; their text is now the
      resolved definition. Commit 8eb259c, tests in
      tests/product-fact-components-extraction.test.js and
      tests/product-table-view.test.js. (c) The election economics. Read
      first: 2.1's 33 VALID facts rendered through buildTableView from the
      stored rows (run 51577c57). The components table did carry the
      ratios, rounded: "Stock election 0.554" (the Share Consideration
      Exchange Ratio is 0.5537; `formatValue` gave a count three decimals)
      and "Acquirer stock 0.239" (the mixed election's 0.2392, on the
      Acquirer stock row because the extractor coded its form PARENT_STOCK;
      the form vocabulary has no mixed code); the cash leg (the
      CASH_COMPONENT fact 608d3d2b) is INVALID with no components stored,
      so no row; the combined definition read "Eligible Shares" (the
      package fact's first DEFINED_TERM; the “Merger Consideration” is
      quoted inside its OBJECT). Built, commit b392cc1: a fourth
      consideration table, `consideration-election-options` ("ELECTION
      OPTIONS": Cash election, Stock election, Mixed election; columns
      Exchange ratio, Cash per share, Value terms, Defined as under the
      row's name), in scripts/product/table-shapes-decision-34.js with the
      manager's words, offered to the extractor like any fixed-list table
      and filled by the page (`fillElectionOptions`) by the table's
      `election_options` rule, data in the shape and validated in
      lib/product/table-shapes.js: a VALID CONSIDERATION fact of the
      component or election subtypes is an option's when its readout
      carries the option's form code (STOCK_ELECTION, CASH_ELECTION) or its
      words match the option's pattern ("election to receive only share
      consideration", "election to receive mixed consideration"), and never
      when they match `unless` ("no election": the mechanics table's "If no
      election" row); its ratio is its value cell in shares, else a numeric
      AMOUNT or THRESHOLD component without a dollar sign; its cash its
      value cell in dollars, else a dollar component; its term the
      readout's term cell, else its first DEFINED_TERM. Then every value
      term the fact's words name (a Defined Terms entry matching
      `(?:Consideration|Value|Amount|Price|Ratio)$`, other than the
      option's own term; a longer term's words are blanked before a
      shorter one is looked for, so “Mixed Share Consideration” is not
      “Share Consideration”): a definition that is a bare number fills the
      empty ratio (a count) or cash (dollars) cell, marked `derived:
      'defined_term'` and citing the definition and the option fact; any
      other is listed under Value terms with, after it, the numbers of the
      value terms its definition names. A row exists once a ratio, cash or
      value-terms cell is filled; a readout's own cell is never
      overwritten. `formatValue` now keeps every digit of a count.
      `combined_definition_from.term_words` (Consideration$) names the
      combined term: the first quoted term matching it, a DEFINED_TERM
      component first, else no combined definition. The contract is
      regenerated (49 tables, 157 columns). NCS 2.1 as the page now reads
      it, for Ben: Stock election [Share Consideration]: Exchange ratio
      0.5537. Mixed election [Mixed Share Consideration]: Exchange ratio
      0.2392; Value terms "Cash Consideration means the Cash Exchange Ratio
      multiplied by the Parent Closing Price", "Cash Exchange Ratio:
      0.1371". Cash per share is hidden (no option states a dollar figure;
      NCS's cash is a ratio times the Parent Closing Price). No Cash
      election row: NCS offers none, and the page does not say "Not
      offered" because an unfilled option can also be a held fact (the
      cash leg here). The components table keeps its rows, now "Stock
      election 0.5537" and "Acquirer stock 0.2392", and its combined
      definition reads “Merger Consideration”. Metsera generation 8 (cash
      plus a CVR): no election table, the components table unchanged.
      For Ben, in order: (1) the row names: "Stock election" as the
      components table's form code has it, or "Share election" as NCS
      drafts it; (2) whether an option with no fact should read "Not
      offered" (the MAE table's "None" precedent) or stay absent as built;
      (3) whether the components table should keep its election rows now
      that the options table carries them, or show the fixed forms only
      (Cash, Parent stock, CVR) with the elections in the new table; (4)
      the Mixed Share Consideration Value (the mixed ratio times the Parent
      Closing Price) is a Defined Terms entry but not on the mixed row,
      because the election fact's words do not name it; a rule naming the
      value term of an option from the definitions alone would need the
      deal's structure, which is Ben's call to describe. Observed, not
      changed: with two options only (a cash or a stock election), each
      value column is filled on one line and Ben's column rule (finding
      (42)) folds it into the row as a trailing detail ("Exchange ratio
      0.5537"), leaving the table with no value columns; the rule holds
      as written and the test records it. The extractor now sees the new
      table in table_shapes and may read a component fact out onto it
      directly, so the stable block changes with the contract as every
      shape change does; the prompt version stays. Tests: the shape, its
      rule and validation (tests/product-table-shapes.test.js), the NCS
      rows and the two-option fallback, a no-election deal, the combined
      term (tests/product-table-view.test.js), the count digits
      (tests/product-fact-conclusions.test.js). npm run test:active: 694
      of 695, the one failure the known Codex-client final-message test.
      Commits 8eb259c, b392cc1 and this plan and guide commit.
      Reconciled at 17:08 UTC with the manager's work package 13 message
      of 16:45 (queued 16:50, delivered after the push of d384c74; built
      on finding (79)'s terms meanwhile). (a) The message names four
      origins; the first build relocated INTRO and CHAPEAU to chapeau
      spans and DEFINITION to definition spans, and OWN already resolved
      through the full section span; CROSS_REFERENCE to cross-reference
      spans is added. The note now names the id written, the closure span
      whose words were used (`to_closure_span_id`) and the component's own
      span within it (`to_span_id`), as asked. The replay fixture
      (tests/product-v8-replay.test.js) is one NCS V8 call and holds no
      3.4 or 3.19 tree, so the check is the unit test with 3.4's real
      quotes and a closure of two chapeau spans. (b) The "is referred to
      in this Agreement as" case is met through the component's
      resolves_to (1.2's Closing Date reads "The date on which the
      Closing occurs"; its Tolling Period "any date that falls on, or
      between, the date(s) of the Irish High Court hearing to sanction
      Rewind ..."). Generation 8 before and after, on the stored rows:
      147 entries both ways, none added or lost, 17 whose text changes to
      the resolved definition: Company Balance Sheet (3.06), Company
      Disclosure Letter (III intro), Company Preferred Stock (3.02),
      Company SEC Documents (3.06), Company Takeover Proposal (8.02),
      Delisting Period (6.12), Effective Time (1.03: "the time the Merger
      becomes effective", was "being referred to herein as"), Exchange Act
      (3.05), Existing D&O Policies (6.05), Filed Company SEC Documents
      (III intro), HIPAA (3.20), HSR Act (3.05), IND (3.17), Paying Agent
      (2.02), Privacy Obligations (3.20), Proceeding (3.14), Proxy
      Statement (3.07). NCS 2.1: Default Stock, Share Election Stock,
      Eligible Shares and Mixed Share Consideration likewise read their
      resolved definitions. (c) The message proposes the rows "Cash
      election; Share election; Mixed election" and columns "exchange
      ratio, cash per share, value per share"; built as "Stock election"
      (the components table's form code) and "Value terms" (the option's
      value defined as a formula, with its numbers), both for Ben as
      above; the single-form Metsera row is unchanged as asked. The
      preview is not downloaded; the stored rows on the preview branch
      are the evidence.
      (81) 2026-10-18 17:20 UTC: work package 13 (finding (80)) accepted
      and merged (d384c74a, a fast-forward; its four suites 169 of 169
      here; its suite 694 of 695 with the known failure). The span
      relocation, the Defined Terms rule and the election options table
      apply to the page at once and to extraction from the next run;
      NCS 3.4's ten held facts stay held in this run (extracted before
      the rule). Four questions on the election table put to Ben. NCS
      generation 5 at 17:10 UTC: RUNNING, 50 of 104, 0 failed, $64.54
      (projection about $134). Read against the text, 3.18 to 4.6:
      3.19's seven intellectual property representations on their
      qualifier rows with the January 1, 2024 look-back and the MAE
      and material qualifiers (the section generation 8 held entirely;
      here no component cited the introduction); 4.1's Parent MAE
      carve-outs on their fixed rows with the disproportionality
      answers, the Rewind consummation and seasonal fluctuations as
      Other carve-outs, the underlying-cause proviso as the footer, and
      the Parent organisation representations on the Parent qualifiers
      table. One shared defect, three held facts, to work package 14: a
      count stated in words is not parsed. 3.2 "no shares of Company
      Preferred Stock were issued and outstanding" and 4.2 "(ii) no
      Parent Ordinary Shares" hold their capitalization facts on "AMOUNT
      needs a canonical value" ("no" is zero); 2.1's cash leg holds on
      "“Cash Consideration” means cash in an amount equal to the product
      of (x) the Cash Exchange Ratio, multiplied by (y) the Parent
      Closing Price", a formula that has no scalar and should not hold
      the fact. Rule: a count component whose words are "no"/"none"/
      "zero" of the counted thing is 0; an AMOUNT whose words define it
      as a product, sum or ratio of defined terms carries no canonical
      value and a note, and the fact stays VALID with its components.
      (82) 2026-10-18 17:20 to 17:39 UTC (implementer), work package 14
      on finding (81)'s rule, begun on its terms at 17:20 and reconciled
      at 17:41 with the manager's message of 17:25 (queued 17:30). No run
      submitted; no live API call. Evidence first, from the preview branch's issues for
      run 51577c57: three facts held on INVALID_FACT_COMPONENTS with "no
      parsable value" and "AMOUNT needs a canonical value", their words
      "no shares of Company Preferred Stock" (3.2, CAPITALISATION/
      ISSUED_AND_OUTSTANDING), "(ii) no Parent Ordinary Shares" (4.2, the
      same subtype) and "“Cash Consideration” means cash in an amount
      equal to the product of (x) the Cash Exchange Ratio, multiplied by
      (y) the Parent Closing Price." (2.1, CONSIDERATION/CASH_COMPONENT);
      a held fact's components are not stored, so the tests carry the
      words. Built, lib/product/fact-components.js: (1) a count whose
      words open with "no", "none (of)" or "zero" (after an enumerator
      such as "(ii)") and carry no digit is 0 (`noneCount`, on the COUNT
      path and the AMOUNT/THRESHOLD path after every number form), so
      "no later than 10 days" and "not more than 10 shares" keep their
      numbers; (2) an AMOUNT whose words name an arithmetic operation
      (product, sum, quotient, ratio, difference, excess, aggregate or
      total of; multiplied or divided by; times, plus, minus, less the)
      on at least two defined terms (capitalised phrases, quoted terms or
      acronyms) and state no number is a formula (`isFormulaValue`): its
      value is { canonical: null, unit: null, form: 'FORMULA' }, the
      validator accepts it, `buildComponentTree` lists it and
      compileProposalComponents reports one VALUE_IS_FORMULA note
      per proposal (client_ref, path, component id, words); the fact
      stays VALID with its components. A formula with a number in it
      ("the product of 0.1371 and ...") is parsed as before, not
      computed. formatValue shows a count of 0 as "0". The contract's
      rule R6 (contracts/product/fact-components.v2.json, not sent to the
      model) records both. On the page: the capitalization table's
      issued count reads 0 from "no shares" through the same parser; the
      cash leg of NCS's mixed election would now be a VALID fact whose
      AMOUNT carries no number, so the election options table shows its
      formula under Value terms as finding (80) built, with the Cash
      Exchange Ratio's 0.1371 after it. The three NCS facts stay held in
      this run (extracted before the rule); the rule applies to the page
      at once and to extraction from the next run. Tests:
      tests/product-fact-components-contract.test.js (the three words
      through buildComponentTree and the validator, the formula
      boundary), tests/product-fact-conclusions.test.js (the parser),
      tests/product-fact-components-extraction.test.js (the two facts
      through compileExtraction: VALID, the value 0, the note). The
      manager's message, read after the first commit (1126129): the note
      is named VALUE_IS_FORMULA as it asks (renamed from
      COMPONENT_VALUE_FORMULA in code, tests, contract and guide); every
      other value rule is unchanged, and prose that is neither a number,
      a count in words nor a formula ("a fee") still holds the fact, as
      the tests show. "The capitalization row shows 0": checked through
      buildTableView, the Preferred Stock row's Issued cell reads "0"
      citing the "no shares" words, with and without a readout
      (tests/product-table-view.test.js). "What the NCS 2.1 rows read
      after the change, from the stored facts": the held cash leg's
      components are not stored, so the check reconstructs it from the
      words the issue kept (the formula AMOUNT) and the package fact's
      mixed-election words, over the 33 stored VALID facts of 2.1. First
      result: the leg backed the Mixed election row and its Cash Exchange
      Ratio (0.1371, a count) was taken as a second exchange ratio
      beside 0.2392, which is wrong: it is a factor of the cash formula.
      Rule added to fillElectionOptions: a value term named only inside a
      formula component is a factor of that formula, never the option's
      ratio or cash; its number is listed under Value terms. The rows now
      read: Stock election [Share Consideration]: Exchange ratio 0.5537.
      Mixed election [Mixed Share Consideration]: Exchange ratio 0.2392;
      Value terms "Cash Consideration means the Cash Exchange Ratio
      multiplied by the Parent Closing Price", "Cash Exchange Ratio:
      0.1371"; Cash per share stays hidden, since no option states a
      dollar figure: the formula fills no cash cell, as the manager's
      "may fill ... through its words" is answered by the Value terms
      column. Tests for both in tests/product-table-view.test.js. npm run
      test:active: 698 of 699, the one failure the known Codex-client
      final-message test. Commits 1126129, 28c9417 and the
      reconciliation commit.
      (83) 2026-10-18 17:58 UTC: work package 14 (finding (82)) accepted
      and merged (268ca08a, a fast-forward; its three suites 95 of 95
      here). NCS generation 5 at 17:53 UTC: RUNNING, 61 of 104, 0
      failed, $80.30 (projection about $137). Read against the text,
      4.6 to 5.3: the no-shop. 5.2's 27 facts on their rows: the
      prohibited acts and the Representative control standard, cease
      existing discussions, return or destruction (six months), the
      data-room cut-off, the 48-hour initial notice, the notice
      contents (identity, unredacted copies, oral summary) and ongoing
      updates, no agreement restricting information to Parent, the
      fiduciary table (bona fide unsolicited proposal before the
      Written Consent, no breach, the fiduciary standard, an Acceptable
      Confidentiality Agreement, information parity within 48 hours,
      the engagement standard), the Acquisition Proposal 20% threshold
      and the Superior Proposal 80% substitution; 5.3's change of
      recommendation (the prohibited actions, the Superior Proposal
      right before the Written Consent, the ten-Business-Day tender
      offer response, the four-Business-Day match and two-Business-Day
      subsequent match, the stop-look-and-listen carve-out). Two notes:
      the fiduciary savings clause ("Company and Company Board actions
      under the fiduciary exception are not a no-shop breach") has no
      row (unplaced; a savings-clause sub-item of the fiduciary table is
      the candidate, listed for the next shapes pass); "Adverse
      Recommendation Change" enters Defined Terms as "any of the
      foregoing actions", the resolved words, which is the definition
      as drafted but reads poorly without the list (watched). One
      failure in flight: 5.1 lost its first attempt at 17:37 to the
      API provider's 64,000-token output cap on part 2 of 3 (the
      restrictions list); work package 15 (the documented maximum
      output cap on the API and an attempt-aware re-split) is with the
      implementer; if 5.1 fails its three attempts the run is retried
      once the worker carries the fix.
      (85) 2026-10-18 18:00 UTC, Ben on the election options table
      (finding (80)'s four questions), verbatim: (1) "STOCK"; (2) "I'D
      SAY \"NOT A DEAL FEATURE\""; (3) "KEEP ELECTIONS BUT ONLY WHEN
      THERE IS AN ELECTIOB"; (4) "WHAT DO YOU MEAN MINE TO SAY?
      SHOYUULDN'T ALL THE INFO BE LINKED/ACCURTE?". On (4) Ben is right
      and the manager's framing was wrong: the link is mechanical, not
      a lawyer's description of the deal. "Mixed Share Consideration
      Value" is defined as the Mixed Share Consideration Exchange Ratio
      multiplied by the Parent Closing Price, so a value term whose
      definition names an option's ratio term (or the option's own
      term) belongs on that option's row; the code reads the
      definitions and links them. Work package 16 to the implementer:
      the row name "Stock election"; an option the deal does not offer
      reads "Not a deal feature" (when no CONSIDERATION fact of the run
      is that option's, VALID or held: a held fact is "held", never
      "not a feature"); the components table keeps its election rows
      only when the deal has an election (the options table has a
      filled row), else the fixed forms alone; the value-term link
      through the definitions, on the mixed row's Value terms and value
      per share, with the derivation cited.
      (87) 2026-10-18 18:35 UTC: 5.1 failed its three attempts at the
      64,000 cap (17:37, 17:55, 18:11) and the run FAILED at 65 of 104
      ($90.84). Work package 15 (finding (84)) accepted and merged
      (3c92b1c8; its three suites 37 of 37 here; its suite 698 of 699
      with the known failure): the API cap at the documented 128,000
      and a smaller split on each attempt after a cap failure; the
      sandbox worker updated to it. The retry (ncs-gen5-retry-5) reset
      5.1 but the wake answered 500 PRODUCT_RUN_MODEL_CONFIG_MISMATCH:
      the run's stored model_config carries the 64,000 cap it was
      created with and the deployed config now says 128,000, and the
      run route compared the whole config. Fixed in code for every run:
      the output cap is an operational limit, not the model's identity
      (modelConfigIdentity in product-model-config.js strips it before
      the comparison; the stored config keeps the cap the run began
      with as history; the deployed cap is used). The old worker
      process (old code, the 64,000 cap) was stopped so that it would
      not spend another attempt on 5.1; the section it was on is
      reclaimed at its lease's expiry. Then the deploy, the worker
      update and a plain wake.
      18:50 UTC: the wake started a worker that refused every section at
      once (PRODUCT_ANTHROPIC_API_MODEL_CONFIG_UNSUPPORTED, zero tokens):
      the worker builds the model from the run's stored config and the
      call-model resolver compared the whole config too. Same rule
      applied there: the resolver compares identities and the request
      carries the deployed cap (128,000) whatever cap the stored config
      names. 5.1 and 846731e1 (the section the stopped worker had
      held) FAILED on it; retried (ncs-gen5-retry-6) after the worker
      update.
      (88) 2026-10-18 19:05 UTC, Ben: "btw IU have a full fable reset to
      use in the next 4 days sop you should burn on agents etc to
      advance this whole thing as much as you cna." Recorded as the
      authority to run several implementers in parallel for four days.
      Tracks, each its own cloud session on the product branch, each
      with a reserved finding range so the plan merges cleanly: the
      existing implementer (A) keeps the extraction and page defects
      from the reads (work packages 16 onward, findings numbered as
      today); implementer B, Phase 6 engineering without the cutover
      (the inactive release pointer load, the V1 against V2 comparison,
      the outside-in smoke test, the rollback drill, each as a script
      and a test on the preview branch; findings (100) to (119));
      implementer C, the analysis track (Q5: harvest the
      representation row_detail values across Metsera generation 8 and
      NCS generation 5, cluster them, propose the canonical list per
      representation for Ben's decision; Q4: the evidence note on what
      legacy Query and Compare consume and what migrating costs, for
      Ben's one-line decision; the Phase 5 reconciliation dry run of
      Ben's Olaplex and Apogee sample notes against the tooling so it
      is ready the hour those runs finish; the UNRESOLVED fact-type
      bookkeeping of finding (66); findings (120) to (139));
      implementer D, parallel hosted workers (a second named sandbox so
      Olaplex and Apogee run at once on the subscription, each run
      owning one sandbox, the wake choosing a free one; findings (140)
      to (159)). The manager merges each track's pushes and resolves
      the plan file.
      Sessions started 19:06 UTC: B session_01B5XEvwn9SgZ7NunbiVun2D, C
      session_01YAd1FqkkFty1a1zkWAJPzW, D session_018dAzV2UwdPbDPRMN9SmCqF
      (A is session_01FcuVU62gzc5H166ZEAXYLP).
      (89) 2026-10-18 19:08 UTC: work package 16 (finding (86), with the
      reconciliation of (84) on the cap and re-split) accepted and
      merged (3ab09895; the table-view and table-shapes suites 125 of
      125 here): "Stock election"; "Not a deal feature" for an option
      with no fact, held for a held one; election forms fold when the
      deal has no election; value terms linked through the definitions.
      NCS at 19:00 UTC: RUNNING again from 65 of 104 on the 128,000 cap.
      (160) 2026-10-18 19:20 UTC (the manager's findings number from
      (160) on while the four tracks run; A keeps (90) to (99), B (100)
      to (119), C (120) to (139), D (140) to (159)). NCS generation 5:
      RUNNING, 71 of 104, 0 failed since retry-6, $104.87. 5.1 went out
      on attempt 4 in four limb parts (work package 15's re-split): part
      2, the restrictions list, answered 115,352 output tokens and
      ended cleanly under the 128,000 cap; parts 3 and 4 25,834 and
      11,332. Read against the text, 5.4 to 5.13: 5.4's Form S-4 and
      Information Statement mechanics on the SEC filing rows (a written
      consent deal, no meeting); 5.6's Written Consent delivery by the
      Consent Time, its DGCL Section 228 effectiveness and the Support
      Agreement counterparts on the meeting table; 5.9's takeover-law
      covenants on their rows. One defect, to implementer A: two 5.6
      facts ("Company submits form of Written Consent to Consenting
      Stockholders instead of holding a stockholder meeting"; "Company
      uses reasonable best efforts to obtain Written Consent by the
      Consent Time") stand only as Defined Terms entries (Consenting
      Stockholders; Consent Time) because their trees carry a resolved
      DEFINED_TERM: a non-definition fact must keep its own placement
      (its family's table, a row by its words or "without a readout")
      and a resolved term adds a Defined Terms entry beside it, never
      instead of it.
      (161) 2026-10-18 19:58 UTC: implementer A's work package 17 with
      its item 4 (findings (90) to (92)) and implementer D's parallel
      hosted workers (finding (140)) accepted and merged (bd14cef6; ten
      suites 293 of 293 here). D's migration
      20261018200000_product_run_sandboxes applied to the preview
      branch before the deploy; its backfill placed NCS generation 5
      (run 51577c57) on pm-codex-preview-worker, so the running
      worker's wakes and keepalive keep their sandbox. The second
      sandbox is created after NCS finishes (create-sandbox-worker.js
      --name pm-codex-preview-worker-2; D's evidence: no per-sandbox
      login, the subscription token travels with every wake). A's
      proposal in (91) becomes work package 18: (a) an inherited quote
      on a known span that does not hold it relocates like an unknown
      one (4.7's three held facts); (b) a reference quantity is a VALID
      component with a note, like a formula (5.11's tail premium cap);
      (c) the publicity row's twelve facts as sub-items, the labels
      proposed for Ben. NCS at 19:50 UTC: RUNNING, 81 of 104, 0 failed,
      $118.85.
      (140) 2026-10-18 (implementer D), parallel hosted workers, on the
      manager's brief of 19:06 UTC. No run submitted, woken or touched;
      nothing created on Vercel; no live sandbox call; the migration is
      in the repository, not applied. Read first: the sandbox runs one
      agreement at a time because the wake names one sandbox
      (SANDBOX_NAME in lib/product/sandbox-wake.js) and the launcher's
      flock serialises workers on it. Built, in code, tested on fakes
      and on inactive Postgres: (1) lib/product/sandbox-pool.js: the
      pool from one constant (SANDBOX_POOL_SIZE = 2: pm-codex-preview-
      worker, pm-codex-preview-worker-2; sandboxPoolNames), the rule as
      a pure decision (decideSandboxAssignment: a run keeps the sandbox
      it owns; a run without one takes the first free name; an owner
      that is READY or FAILED is released in the same decision; a full
      pool is BUSY; a READY or FAILED run takes none), and
      assignSandboxForRun, which throws PRODUCT_SANDBOX_POOL_BUSY naming
      the holders. (2) Migration 20261018200000_product_run_sandboxes:
      table product_run_sandboxes (run_id, sandbox_name, assigned_at,
      released_at, release_reason; one live row per sandbox name by a
      partial unique index), product_sandbox_assign(run, pool) as the
      atomic form of the decision (one advisory lock per decision, so
      two wakes for two new runs never take the same free sandbox),
      product_sandbox_release(run, reason); service_role only, as the
      Phase 3 functions. It backfills the most recently updated RUNNING
      or PARTIAL run onto pm-codex-preview-worker (one lock, one worker:
      at most one run is live there), so the run on it when the
      migration is applied, NCS generation 5 if still running, keeps its
      sandbox, its keepalive and its wakes; any other unfinished run has
      no worker and is placed at its next wake. (3) The run route
      (lib/product/run-handler.js): after the retry and the model-config
      check, the run's sandbox is taken (KEPT or ASSIGNED) and the wake
      goes there (wakeSandboxProductRun and keepSandboxAlive take
      sandboxName; the gone error names its sandbox and the create
      command with --name); BUSY answers 503 { error:
      PRODUCT_SANDBOX_POOL_BUSY, sandboxes } with Retry-After 300 and
      launches nothing (the run keeps its state; the intake panel says
      "Every worker sandbox is busy: <name> (run ..., RUNNING); ... press
      Continue analysis when one finishes", and start-generation.js
      prints the holders and the wake to repeat); a READY or FAILED run
      gets 202 with wake_command_id null and state RUN_ENDED instead of
      a worker that exits at once; a gone sandbox releases the run
      (reason SANDBOX_GONE) so its next wake is placed again (the pool
      cannot know a sandbox is gone before a wake tries it, so the next
      wake takes the first free name again until the operator recreates
      it); { keepalive: true } resumes the run's own sandbox, and
      answers { state: NOT_ASSIGNED } in the same 200 for a run without
      a live assignment (never woken on the pool, or finished), so the
      manager's monitor pattern of finding (60) is unchanged in form;
      { release_sandbox: true } ends a run's ownership by hand (reason
      OPERATOR:<actor>) for a PARTIAL run nobody will wake again. The
      202 body carries sandbox { sandbox_name, state, sandboxes }. The
      launcher (its flock is per sandbox because each sandbox has its
      own filesystem), the worker and the lease recovery are untouched;
      the launcher test holds the flock line. (4) Reads: the analysis
      GET carries sandbox { sandbox_name, assigned_at, released_at,
      release_reason, live }; the preview's progress.sandbox names the
      live one; the provisions page shows "on <name>" beside the
      provider while the run is in progress; the intake panel shows
      "Worker sandbox: <name>" under the status. A read before the
      migration is applied reads no placement and warns once, so the
      status poll never breaks on it; the wake fails loudly on the
      missing function. (5) Scripts: create-sandbox-worker.js and
      update-sandbox-worker.js take --name <sandbox> (a name outside the
      pool is refused) or walk the pool; the create leaves an existing
      sandbox to the update; the update checks the launcher's lock
      inside each sandbox (flock -n) and skips one whose worker is live
      (an npm ci under a live worker removes modules it may still load)
      unless --force. Both provision every sandbox the same way
      (finding (49)'s steps). Repository evidence on the manual step the
      brief expected ("the Claude CLI login"): there is none per
      sandbox. The Claude CLI provider installs @anthropic-ai/claude-code
      with no login in the sandbox; the subscription token is
      PRODUCT_CLAUDE_CODE_OAUTH_TOKEN on the deployment, passed to the
      sandbox on every wake as CLAUDE_CODE_OAUTH_TOKEN (sandbox-wake.js,
      launch.sh, create-sandbox-worker.js's PROVIDER_SETUP), so one
      token serves both sandboxes; Ben repeats `claude setup-token` only
      if that token has expired, once, and updates the deployment
      variable. The Codex provider's device login is per sandbox and the
      create script runs it for each name it creates. Two sandboxes on
      one subscription draw on the same five-hour usage window twice as
      fast; a limit stops a worker as finding (73) says and a plain
      wake resumes the run on its own sandbox. Not decided here, for
      the manager: ownership "until READY or FAILED" means a PARTIAL run
      stopped on a usage limit holds its sandbox while nobody wakes it;
      the release action and the BUSY answer's holders cover that by
      hand; a rule that frees a sandbox whose owner has had no section
      commit for some hours would be the code answer. Tests:
      tests/product-sandbox-pool.test.js (names from the constant; the
      decision in every state; ownership across wakes and the BUSY
      error; the route placing two runs, the third's 503 with holders
      and Retry-After, KEPT on a second wake, the READY run launching
      nothing; a gone sandbox released and re-placed; the keepalive on
      the run's sandbox, NOT_ASSIGNED and the operator release; the wake
      and the keepalive resuming the named sandbox and refusing a name
      outside the pool; the reads and the page; the panel's words and
      record), tests/product-sandbox-worker-scripts.test.js (the two
      scripts' arguments, the pool walk with a fake sandbox API, the
      busy skip, --force, the gone message; no credential in any
      output), tests/product-sandbox-pool-db.test.js on local Postgres
      16 (the backfill; the function against the decision over the rows
      before each call in every state; the release; the index; bad
      input; a three-name pool; the grants; the rollback), added to the
      CI database step. npm run test:active: 716 tests, 715 pass, the one failure the known Codex-client final-message test; `npm run build` compiles; the database suite ran here on Postgres 16 (4 of 4).
      Commands for the manager, in this order, once NCS is finished (or
      the migration first while it runs: the backfill then records NCS
      on the first sandbox): (a) apply
      supabase/migrations/20261018200000_product_run_sandboxes.sql to
      the preview branch (ecrtoofsyxozazkvsvcl) before the deployment
      carries this code, and check `select run_id, sandbox_name,
      released_at from product_run_sandboxes;`; (b) merge and deploy;
      (c) from a shell with VERCEL_TOKEN, VERCEL_TEAM_ID and
      VERCEL_PROJECT_ID: `node scripts/product/create-sandbox-worker.js
      --provider ANTHROPIC_CLAUDE_CLI_SUBSCRIPTION --name
      pm-codex-preview-worker-2`; (d) `node
      scripts/product/update-sandbox-worker.js` to bring the first
      sandbox to the tip (skipped while a worker holds its lock); (e)
      start Olaplex and Apogee with start-generation.js as before, one
      after the other: the first takes pm-codex-preview-worker, the
      second pm-codex-preview-worker-2, and each monitor's { keepalive:
      true } extends that run's sandbox.

      (84) 2026-10-18 18:05 to 18:20 UTC (implementer), work package 15
      on finding (83)'s terms ("the documented maximum output cap on the
      API and an attempt-aware re-split"), begun before the manager's
      message. No run submitted, no run or worker touched; no live API
      call. Evidence, from the preview branch: 5.1's section row has two
      failures in its error_history, both "ANTHROPIC_API_OUTPUT_TRUNCATED:
      the answer ran past the output cap (64000 output tokens)" (attempt
      1 at 17:37, attempt 2 at 17:55), and its extraction calls show the
      same three parts each time: part 1 about 126,500 input and 2,900
      output tokens, part 2 130,758 input and 64,000 output (the cap,
      about 700 s), part 3 about 25,000 to 28,000 output; the third
      attempt was running at 18:00 with the same parts. The documented
      maximum, platform.claude.com/docs/en/models/opus-5/overview read
      2026-10-18: "Max output: 128K tokens", the synchronous Messages API
      limit, for claude-opus-5 and claude-opus-5-5 alike (300K only on
      the Message Batches API under a beta header, not used). Built: (1)
      `ANTHROPIC_API_MODEL_CONFIG.max_output_tokens` is 128000, the
      source in its comment; (2) `splitForAttempt(split, claim)`
      (lib/product/agreement-draft.js), called by the runner for every
      claim: for each earlier attempt of the section whose recorded error
      names an output cap (ANTHROPIC_API_OUTPUT_TRUNCATED, the CLI path's
      CLAUDE_OUTPUT_TRUNCATED, by code or message), the parts' byte size
      halves (3,500, then 1,750, then 875, down to a floor of 500) and a
      section too short to split before is split now; any other failure
      (a JSON failure, a database error) leaves the split as it was, and
      a limb is never cut, so a single limb that still overflows is left
      to the cap. The LONG_SECTION_SPLIT issue records the group_bytes
      used and after_output_cap. (3) The failure record
      (phase-1-store.js failSection) now carries the error's code beside
      its message, so the history is read by code and not by words alone;
      the two 5.1 entries, recorded before this, are read by their
      message. On 5.1 the next attempt after a cap failure would send
      parts of 1,750 bytes at a 128,000-token cap: the restrictions list
      that filled 64,000 tokens as one part goes out in about two, each
      with twice the room. The cap and the split are the two levers the
      manager named; a third, not built, is the structure: part 2's
      130,758 input tokens say the restrictions list is one long limb
      with sub-limbs, and if a limb alone exceeds a part the paragraph
      split of work package 9 would be the next rule. Tests:
      tests/product-anthropic-api-provider.test.js (the cap),
      tests/product-long-section-split.test.js (splitForAttempt on the
      recorded messages, by code, the floor, no change for other
      failures or for a whole-section caller; Concho 6.3 extracted in
      more parts after a cap failure with every limb in exactly one part
      and the issue saying so; the split suite is outside the active list
      and run directly, 81 of 81 with the pool and phase-2 suites). npm
      run test:active: 698 of 699, the one failure the known Codex-client
      final-message test. The worker carries the fix once the manager
      updates the sandbox worker to this branch's tip; the run route
      needs no redeploy for it. Commits: the code and tests commit and
      this plan and guide commit.
      (86) 2026-10-18 18:25 to 18:40 UTC (implementer), work package 16
      on finding (85), Ben's four answers on the election options table,
      each in code for every agreement, his words in the shape
      generator's comment. No run submitted or touched; no live API
      call. (1) "STOCK": the row stays "Stock election" (built so in
      (80); recorded). (2) "I'D SAY \"NOT A DEAL FEATURE\"": the options
      table has absent_row_label "Not a deal feature", shown for a fixed
      row no fact fills once the table has a filled row (the existing
      rule, so a deal without an election shows no table and no
      "feature" line). The manager's qualification, "a held fact is
      'held', never 'not a feature'": the preview skipped every
      non-VALID proposal (lib/product/provisions-preview.js), so a held
      fact never reached the tables; a held V2 proposal keeps its
      component tree in its payload (checked on the preview branch: NCS
      2.1's held cash leg 608d3d2b has eight components with their words,
      "with respect to which an election to receive mixed consideration
      ...", "the Cash Consideration", the Cash Consideration formula).
      previewFactsFromWorkspace now returns `held_facts` (layered,
      non-VALID, not rejected), the provisions page hands them to
      PublishedSummary and buildTableView takes `heldFacts`, read by the
      election options rule alone: a held fact is placed on its option
      by the same words rule (it has no readout); an option with no
      filled row and a held fact is a row reading the rule's
      held_row_label, "Held: this option's fact is held by validation",
      its held fact cited (data-held on the page); a held fact of a
      filled option backs that row, marked held. (3) "KEEP ELECTIONS BUT
      ONLY WHEN THERE IS AN ELECTIOB": the per-share table's
      `election_forms` (CASH_ELECTION to CASH, STOCK_ELECTION to
      PARENT_STOCK) and `foldElectionForms`: when the options table has
      no filled row, a per-share row coded as an election form folds
      into its plain form's row (cells merged, the form cell recoded with
      folded_from); with an election the rows stay; the table's guidance
      tells the extractor the election forms are for an election deal
      only. (4) "WHAT DO YOU MEAN MINE TO SAY? SHOYUULDN'T ALL THE INFO BE
      LINKED/ACCURTE?": the link through the definitions, mechanical as
      the manager put it. Each option row keeps its own term and the
      numeric terms its facts name (its ratio or cash terms); every value
      term whose definition fact's own words (not its summary) name one
      of them is linked to the row, with the longest defined term matched
      first over all terms (the first render linked the mixed terms to
      the stock row because "Share Consideration Exchange Ratio" sits
      inside "Mixed Share Consideration Exchange Ratio"; fixed before
      commit). A linked term matching the rule's value_term ("Value$")
      goes under a new Value per share column, any other under Value
      terms, each cell marked derived 'definition_link' with `via` the
      term that links it and citing the definition; the numeric terms the
      definition names in turn are listed after it. NCS 2.1 as the page
      now reads it, from the stored facts with the held cash leg: Cash
      election: Not a deal feature. Stock election [Share Consideration]:
      Exchange ratio 0.5537. Mixed election [Mixed Share Consideration]:
      Exchange ratio 0.2392; Value per share "Mixed Share Consideration
      Value means the mixed exchange ratio times the Parent Closing
      Price" (linked via Mixed Share Consideration Exchange Ratio; the
      text is the Defined Terms entry's, the model's summary, which
      paraphrases "the mixed exchange ratio"); Value terms "Cash
      Consideration means the Cash Exchange Ratio multiplied by the
      Parent Closing Price", "Cash Exchange Ratio: 0.1371"; the held cash
      leg backs the mixed row; Cash per share hidden. The per-share table
      keeps Stock election 0.5537 and Acquirer stock 0.2392. Metsera
      generation 8 (thirteen held facts passed): no election table, the
      per-share rows unchanged. Observed, for the manager: the linked
      text is the Defined Terms entry's text, so where the model's
      summary paraphrases the words the cell paraphrases too; reading the
      definition fact's own words instead would change every Defined
      Terms entry and is a separate decision. Tests: the shape and its
      validation (tests/product-table-shapes.test.js), the absent and
      held rows, the link and its longest match, the fold with and
      without an election (tests/product-table-view.test.js), the held
      row's label and data-held (tests/product-provision-tables.test.js),
      held_facts from the preview (tests/product-provisions-preview.test.js).
      npm run test:active: 702 of 703, the one failure the known
      Codex-client final-message test. The page changes apply on the
      branch's next deploy; nothing in the worker changes. Commits: the
      code and tests commit and this plan and guide commit. Correction
      to (84), read from (87) at 18:40: "the run route needs no redeploy
      for it" was wrong. The run's stored model_config carried the
      64,000 cap as part of the identity the run route and the
      call-model resolver compared, so raising the deployed cap refused
      the running run's wake and then every section; the manager's
      commits 70c704f and 4247603 make the cap an operational limit
      outside the identity. I should have read the identity comparison
      before changing a value inside the config; noted for every
      config change from here.
      (88) 2026-10-18 18:42 to 19:04 UTC (implementer): work packages 15
      and 16 reconciled with the manager's messages of 18:00 and 18:05
      UTC, both delivered at 18:42, after (84) and (86) were built from
      the findings. No run touched. Work package 15. The message's rule is
      finer than (84)'s: "each part of the previous split that passed the
      cap is halved by its limbs (a part of one limb that still passes the
      cap goes to paragraphs mode within that limb); for paragraphs mode,
      the part size halves". (84) halved every part's size, which cannot
      cut a limb: 5.1's structure (read from the run's agreement
      structure) is a 33-byte chapeau and three limbs, (a) 13,108 bytes
      with twenty-seven sub-limbs (i) to (xxvii), (b) 1,776 bytes with
      five, (c) 418 bytes, so the first split is [chapeau], [(a)],
      [(b), (c)], part 2 is limb (a) alone, and at 1,750 or 875 bytes it
      is still (a) alone; only the 128,000 cap would have changed its
      outcome. Built now: the part loop puts the failed part on the error
      (`extraction_part`: part, of, mode, span ids), failSection stores it
      beside code and message, and `splitForAttempt` carries such parts as
      `cap_failed_parts` to `resplitAfterOutputCap`, which replays the
      failures in order: a failed part of two or more spans is halved by
      bytes; a failed part of one limb becomes the paragraphs within that
      limb (the residual pass's paragraph spans inside its byte range),
      grouped to the usual size, the mode then limbs+paragraphs and each
      such part told it covers the paragraphs of one limb; a failed part
      of one paragraph cannot shrink and stays. A failure record without a
      part (the three 5.1 failures at 17:37, 17:55 and 18:11 were written
      before this) keeps (84)'s rule. The LONG_SECTION_SPLIT issue records
      group_bytes, after_output_cap, resplit_parts and the mode. The part
      counts asked for, 5.1 on this rule: attempt 1, three parts; attempt
      2, after a record naming part 2, seven parts ([chapeau], (a) in five
      paragraph parts of 2,575, 3,253, 2,756, 3,202 and 1,322 bytes if each
      sub-limb is a paragraph, [(b), (c)]); attempt 3, after one of those
      paragraph parts ran past the cap, eight (that part halved by
      bytes), or nine if [(b), (c)] failed too. Whether the retry's reset
      of 5.1 kept its error_history is the manager's to say; without it
      the retry's first attempt is three parts at the 128,000 cap. Tests:
      resplitAfterOutputCap on a synthetic closure of that shape, the
      carried parts against the halving rule, and Concho 6.3 with a model
      that runs past the cap on its last part (the error names the part;
      the next attempt splits that part alone, the issue says so)
      (tests/product-long-section-split.test.js). Work package 16. The
      message puts a linked value term "under Value terms (and in the
      value-per-share cell when the definition is a bare number)"; (86)
      had sent a "...Value" term to a verbatim Value per share column.
      Now: Value per share is a value column (AMOUNT) filled by a linked
      bare-number definition; a linked formula definition sits under Value
      terms after the option's own value terms; the cell cites the
      definition and the option's facts, and a reading keeps its `derived`
      and `via` through a merge. NCS 2.1 as the page reads it: Cash
      election: Not a deal feature. Stock election [Share Consideration]:
      Exchange ratio 0.5537. Mixed election [Mixed Share Consideration]:
      Exchange ratio 0.2392; Value terms "Cash Consideration means the
      Cash Exchange Ratio multiplied by the Parent Closing Price", "Cash
      Exchange Ratio: 0.1371", "Mixed Share Consideration Value means the
      mixed exchange ratio times the Parent Closing Price" (via Mixed Share
      Consideration Exchange Ratio); Cash per share and Value per share
      hidden (no option states either as a number). The stock election
      carries no linked term, as the message expects for NCS; the negative
      is tested (the longer mixed term links nothing to it). Metsera
      generation 8 unchanged. npm run test:active: 702 of 703, the one
      failure the known Codex-client final-message test; the split suite
      (outside the list) 11 of 11. The worker carries the re-split once
      the manager updates the sandbox worker to this tip; the page
      changes apply on the next deploy. One commit for code, tests and
      this finding.
      (90) 2026-10-18 19:17 to 19:36 UTC (implementer A), work package 17
      on the manager's message of 19:10, three rules for every agreement.
      No run touched. (1) The no-shop savings clause. NCS 5.2(d), stored
      as NO_SHOP/EXCEPTION_PREREQUISITE fe7c93cc with no readout: "Parent
      and Merger Sub acknowledge and agree that any determination or
      action by the Company or the Company Board in accordance with
      Section 5.2(c) shall not be deemed to be a breach or violation of
      this Section 5.2(a)". The fiduciary-out table gains the fixed row
      "Fiduciary actions are not a breach" (Yes / No, as drafted) and a
      new shape key, `words_rows`: a readout-less fact of the table's
      family whose words match the rule's pattern takes the row, the
      rule's code (YES) on the provision column citing the words that
      match, the fact as drafted; `defaultConclusions` applies it before
      the fact-type default, so the extractor's missing-readout default
      and the page's placement of stored facts are one rule. The pattern
      takes "shall not be deemed to be a breach or violation", "shall not
      constitute a breach" (Metsera's form) and "will not be deemed to
      constitute a breach", and not "did not result from a breach" (the
      prerequisite, its own row). Generation 8's stored facts carry no
      Metsera savings-clause fact to place (searched the 974 proposals
      for a negated breach in NO_SHOP words); the rule is tested on
      both phrasings. Contract regenerated (158 columns, one row added);
      validator for the key (row in the fixed list, pattern compiles,
      code in the row's vocabulary). (2) Back-reference definitions. NCS
      5.3's two RECOMMENDATION_CHANGE facts (a518b541, 52546772) each
      carry the DEFINED_TERM "(any of the foregoing actions, an “Adverse
      Recommendation Change”)" resolving to "any of the foregoing
      actions". `definedTermParts` now recognises a resolved definition
      that is a back-reference (any/all/each of the foregoing, such
      action(s), the above) and shows it with the words it refers to:
      the fact's own words before the term in source order, else the
      fact's statement; the back-reference is kept in front and the
      entry's `note` says which was used (shown under the definition on
      the page). Two facts defining one term that way merge with "; ",
      so the entry lists both sentences: "any of the foregoing actions:
      Except to the extent permitted by Section 5.2(c) the Company Board
      ... withhold, withdraw or adversely qualify (or modify or amend in
      a manner adverse to Parent) the Company Board Recommendation; any
      of the foregoing actions: ... authorize, approve, adopt or
      recommend any Acquisition Proposal". A resolved definition that is
      not a back-reference is unchanged. (3) Held facts on the page. The
      preview's held facts (work package 16) now carry `held_reason`,
      built by `heldReason` from the run's issues: the proposal's own
      INVALID_FACT_COMPONENTS problems by component path, each turned
      into the component's words (shortened at a word, 80 characters)
      and what went wrong in plain words ("could not be placed in the
      source text", "no number could be read from its words", "words
      that are not in the source"), and, where the section's node-level
      issue names the same component's quote as UNKNOWN_SOURCE_COMPONENT,
      "its quote cites a span the section does not have". buildTableView
      lists held facts under their family's section (`held_facts`:
      reference, headline, reason), a section with only held facts is
      shown, and ProvisionTables renders them in the quiet style behind
      "N facts held by validation · see why". NCS 3.4's held fact
      05e8ab96, from the stored rows: "“Except as set forth in (a) any
      Company SEC Document filed with or furnished to…”: its quote cites
      a span the section does not have; “(b) the disclosure letter
      delivered by the Company to Parent immediately prior…”: its quote
      cites a span the section does not have; “the Company represents and
      warrants to Parent and Merger Sub as follows:”: its quote cites a
      span the section does not have", which is finding (79)'s diagnosis
      in Ben's words. Tests: the row, rule and validation
      (tests/product-table-shapes.test.js); the NCS and Metsera words on
      the row and the prerequisite off it
      (tests/product-fact-conclusions.test.js); the back-reference entry,
      its merge, its note and the unchanged case, and held facts per
      section (tests/product-table-view.test.js); the held list's
      rendering (tests/product-provision-tables.test.js); heldReason's
      words and the preview's held_reason
      (tests/product-provisions-preview.test.js). npm run test:active:
      707 of 708, the one failure the known Codex-client final-message
      test. The page changes apply on the next deploy; the savings-clause
      default reaches extraction from the next worker update. One commit
      for code, tests and this finding.
      (91) 2026-10-18 19:38 UTC (implementer A): the NCS read after
      finding (160)'s 5.13, from the stored rows on the preview branch
      (no run touched). Complete since: 5.14 (12 facts) and 5.15 (1);
      the run at 5.16 and the next section RUNNING, the rest PENDING.
      5.14, publicity: all twelve GENERAL_COVENANTS/PUBLICITY facts land
      on the general covenants table's "Public announcements" row (the
      joint announcement release and its approval, the consultation and
      review duty and its Law, court-process and exchange carve-out, the
      four carve-outs (i) to (iv): ordinary-course statements, employee
      communications, dispute statements and the Specified Stockholders'
      disclosure to limited partners and website posting of the
      consummation without economic terms, and the consistency proviso),
      every cell EACH_PARTY or UNQUALIFIED_OBLIGATION; twelve readings on
      one row are correct and unreadable. 5.15, Section 16: one fact on
      its row, right. Read back over the earlier sections' held facts
      for the defect classes that remain: 4.7 (Parent's Form S-4 and
      Information Statement representations) holds three of four facts
      on NOT_EXACT_CONTIGUOUS_SOURCE_TEXT: each cites the Article IV
      introduction's words (origin INTRO: "Parent and Merger Sub
      represent and warrant to the Company as follows", the two
      Except-as-set-forth qualifiers) on span 3d0f7a06, which is the
      Article III chapeau span (the span finding (79)'s 3.4 facts named
      one character off); the words are verbatim in the closure's own
      Article IV chapeau span. Work package 13 (a) relocates a quote on
      an unknown span; here the span is known and simply does not hold
      the words, so the hold stands. 5.11 holds one fact (aeb3313d, the
      D&O tail premium cap) on "AMOUNT needs a canonical value" for "the
      last aggregate annual premium paid by the Company prior to the
      date hereof", a reference quantity with no number by design, the
      class beside work package 14's formula. 5.8 and 5.11 each dropped
      one headline summary for naming a section ("Section 5.8 leaves
      Parent free to make acquisitions, loans and investments"); the
      label-built term is used, as the rule says. 5.1 completed on
      attempt 4 with CONCLUSIONS_DEFAULTED and CONCLUSIONS_CELLS_DROPPED
      notes only. Proposed as work package 18, for the manager: (a) a
      quote of inherited origin (INTRO, CHAPEAU, DEFINITION,
      CROSS_REFERENCE) cited on a known span that does not contain it,
      found verbatim in exactly one closure span of a kind its origin
      allows, is relocated to that span with the same
      COMPONENT_SPAN_RELOCATED note as work package 13 (a) (the id
      written kept as evidence); two candidates or none keep the hold;
      own words stay as they are. Evidence: 4.7's three facts; test with
      their real words and the Article III and IV chapeau spans. (b) An
      AMOUNT whose words name a reference quantity and state no number
      ("the last aggregate annual premium paid by the Company prior to
      the date hereof", "the amount set forth in Section 5.11(b) of the
      Company Disclosure Letter") carries { canonical: null, unit: null,
      form: 'REFERENCE' } and a VALUE_IS_REFERENCE note, the fact VALID,
      as the formula rule does; prose that is neither still holds.
      Evidence: 5.11's fact. (c) For Ben, a shape question: the
      publicity row's twelve facts as sub-items under "Public
      announcements" (Announcement release; Consultation and review;
      Carve-outs: ordinary course, employees, disputes, sponsor
      disclosure; Law or exchange exception), by detail labels and
      words rules, so a sponsor-backed seller's carve-outs read as a
      line of their own; the code proposes the labels, Ben names them.
      (d) Nothing to change for the dropped summaries; the rate is two
      in 73 sections and the rule is the extractor's.
      (92) 2026-10-18 19:44 UTC (implementer A), work package 17 item
      4 (the manager's addendum of 19:22, delivered 19:41): a fact that is
      not a definition keeps its own placement; its resolved DEFINED_TERM
      components add Defined Terms entries beside it. Checked against the
      stored facts before changing anything. The two NCS 5.6 facts
      (1950d63a, "Company submits form of Written Consent ... instead of
      holding a stockholder meeting"; 8ad8b028, "Company uses reasonable
      best efforts to obtain Written Consent by the Consent Time") carry
      readouts on votes-approvals-meeting-table, rows "Written Consent
      submission" and "Written Consent receipt" (the table is open to new
      rows), with the Consenting Stockholders and Consent Time terms
      resolved. Run through buildTableView as stored, both land on those
      rows under the meeting section, nothing under "without a readout",
      and the two entries sit in Defined Terms citing the facts: the rule
      the addendum states is what the code on this branch does, since
      work package 13 (b) (8eb259c) confined the Defined Terms exemption
      to definition facts (collectDefinitionFact) and left every other
      fact to its table. I could not reproduce the page the manager saw
      from the stored rows; a preview served before 8eb259c reached the
      deploy, or the meeting section collapsed, would show the entries
      and not the rows. Which facts move out of Defined Terms under the
      rule: on Metsera generation 8's 961 facts, none (the 83 facts that
      stand in Defined Terms alone are all KEY_DEFINED_TERMS definition
      facts; 873 are on tables, 2 without a readout, 3 are definition
      facts merged into an earlier entry of the same term); on the NCS
      rows held here (1.2, 2.1, 3.4) none (the 9 Defined-Terms-only facts
      are 2.1's KEY_DEFINED_TERMS definitions); on 5.6, the two facts are
      on their rows. Added, so the rule is pinned: a test with the two
      NCS facts as stored (rows kept, entries beside them, nothing
      without a readout) and a definition fact that enters Defined Terms
      alone with no row (tests/product-table-view.test.js, 75 of 75). No
      code change; the test commit alone.
      (93) 2026-10-18 20:02 UTC (implementer A): the NCS read after
      finding (91), from the stored rows on the preview branch (no run
      touched); the run at 80 of 104 complete, 0 failed, 24 open.
      Complete since: 5.16 (24 facts), 5.17 (41), 5.18 (5), 5.19 (9),
      5.20 (1), 6.1 (11); every fact VALID, nothing held. 5.16, employee
      matters: fourteen facts on employee-benefits-other-protections
      rows (401(k) termination, vesting, contributions, rollover,
      service crediting, waiting-period waiver, deductible credit, no
      third-party beneficiaries, no plan amendment, right to amend) and
      ten on employee-benefits-table rows with comparison and standard
      codes; right. Two summaries dropped for naming the section
      ("Section 5.16 confers no rights on employees"); their rows carry
      the meaning. 5.18, payoff letters: four facts on "Payoff letters"
      REQUIRED and one on "Cost and risk allocation" PARENT_BEARS_COSTS
      (Parent repays the Company Indebtedness at Closing). 5.19, the
      Rewind novation: seven facts on "Assignment", two on
      "Construction"; the coverage flag UNRESOLVED_UNUSUAL_PROVISION
      stands beside them, right. 5.20, the Canadian tax deposit: one fact
      on "Special tax mechanic". 6.1, mutual conditions: ten facts on
      their conditions-table rows (Written Consent obtained and not
      revoked, HSR, the Disclosure Letter approvals, no Law, no
      injunction, S-4 effective, no stop order, Nasdaq listing); two
      quotes cited on an unknown span relocated to the section span
      (COMPONENT_SPAN_RELOCATED, work package 13 (a)); the eleventh fact
      (f54d1f70, "Information Statement mailed to Company stockholders at
      least 20 Business Days before Closing", PERIOD 20 BUSINESS_DAY)
      has no readout (CONCLUSIONS_MISSING): the mutual table is a fixed
      list with no open row and GENERAL_CLOSING_CONDITION names a row
      only on the party tables (BRINGDOWN), so it shows under 6.1
      "without a readout". The run's 86 CONCLUSIONS_MISSING over 19
      sections are, by fact type: 49 PER_SHARE_CASH_CONSIDERATION
      (exchange mechanics, 2.2, 2.3, 2.5, expected per finding (160)'s
      line), 24 OTHER_DEFINED_TERM_RECORDED (Defined Terms entries), 7
      MERGER_STRUCTURE_MECHANIC_PRESENT, 4 MAE_CARVEOUT (3.1, 4.1), this
      one condition and one NO_SHOP EXCEPTION_PREREQUISITE (5.2).
      5.17, the Specified Stockholders' registration rights, is the
      section to act on. The catalogue has no registration-rights
      family: fifteen of the section's limbs are flagged
      UNRESOLVED_UNUSUAL_PROVISION and the extractor still returned 41
      facts. 32 are GENERAL_COVENANT_PRESENT on the general covenants
      table, but the rows are wrong: 13 sit on the fixed row "General
      notification" (the shelf filing or Rule 424(b)(7) supplement,
      keeping the Registration Statement effective, filing amendments,
      Rule 144 current-information compliance, timely Exchange Act
      reports, the prospectus correction duty, naming the Specified
      Stockholders as selling securityholders), 3 on "Access to
      information" (the stockholders' approval of their disclosures, the
      filing bar without it, the information they furnish), 3 on "Stock
      exchange listing" (Nasdaq listing maintenance, DTC eligibility), 1
      on "Litigation notification" (Nasdaq or SEC proceedings), 9 on an
      open row "Registration rights indemnification" (Parent's indemnity
      and reimbursement, the stockholders' several indemnity capped at
      net proceeds, survival, the furnished-information scope), 2 on an
      open row "Registration rights" (legend removal, Rule 144 resales)
      and 1 on "Registration expenses". Three further defects on these
      rows: (i) the Specified Stockholders' own covenants (their several
      indemnity, reimbursement, information cooperation, the filing-bar
      approval right) have no obligor cell, the vocabulary being COMPANY,
      PARENT, EACH_PARTY; (ii) the 424(b)(7) filing reads standard
      PROMPTLY and its outside date, PERIOD "no later than two Business
      Days thereafter" { 2, BUSINESS_DAY }, reaches no cell, the as-
      drafted column citing OPERATION, OBJECT, CONDITION, STANDARD,
      EXCEPTION and QUALIFIER and never TRIGGER or PERIOD (5.18's payoff
      letter lead time, PERIOD { 3, BUSINESS_DAY } on a fact type named
      for it, is lost the same way on the financing table); (iii) the
      other 9 facts are CAPITALISATION_VALID_ISSUANCE_STATUS and
      CAPITALISATION_RESERVED_OR_ISSUABLE_SECURITIES on the
      capitalization table's "Parent Ordinary Shares" row (duly
      authorized and nonassessable, free of Liens and preemptive rights,
      newly issued or treasury, not initially registered, Section
      4(a)(2) reliance, "restricted securities" under Rule 144, the Rule
      144(d) holding period from the Closing Date, no contractual
      transfer restrictions), so 5.17 shows a Capitalization table of
      securities-law statements about the stock consideration beside its
      covenants. Proposed as work package 18 items (e) to (g), for the
      manager and Ben; (a) to (d) of finding (91) stand. (e) Code, the
      mechanism exists: a words_rows rule on the general covenants table
      (work package 17's rule) placing a covenant whose words name the
      Registration Statement, Registrable Securities, a prospectus, Rule
      144 or Rule 415 on one row, "Registration rights", with
      sub-items by words (Resale registration; Effectiveness and
      amendments; Stockholder information and approval; Indemnification;
      Expenses; Rule 144 and legend removal; Listing and reporting);
      the code proposes the labels, Ben names them, and the 13 facts
      leave "General notification". (f) Shape questions for Ben: an
      obligor code for a party that is neither Company nor Parent (the
      Specified Stockholders here; a sponsor or guarantor elsewhere),
      and whether the as-drafted column of covenant tables cites TRIGGER
      and PERIOD so a deadline shows on the row, or a "By when" value
      column shows it; (g) a lawyer question for Ben: where the
      securities-law status statements about the stock consideration
      belong (a Registration rights row of the covenants table, a
      Consideration row, or the Capitalization table as the model chose).
      (h) For the mutual conditions table, one more shape question: an
      open row for a mutual condition the fixed list does not name (the
      Information Statement mailing period here), or the "without a
      readout" list as now. No code changed for this finding.
- [x] Q6 (earlier note, kept for the record). The interim operating covenants section is one
      structure node with twenty-odd child limbs; the extractor returned
      five facts and marked the family UNRESOLVED (Metsera generation 3).
      The source closure already knows the children (`operativeNodes` in
      `lib/product/source-context.js`). Proposal: when a section's closure
      exceeds a token threshold and the node has children, extract per
      child group (chapeau plus each limb group plus the definitions they
      use) and merge, so no single call carries the whole article; and
      treat a family-level UNRESOLVED on a long section as a partial
      decline that retries the uncovered children. Needs Ben's go-ahead
      on the cost (more calls per long section). Ben
      sent the Deal Storylines / Corpus timeline page: "shift the page
      design to match this ... mainly thinking of the left hand side bar,
      page header and the right hand side bar". The rail is the black
      column with the parties at the top and a white active row; the
      page header is eyebrow, large title and a black rule; the evidence
      panel is white with the section reference as eyebrow, the headline
      as title, an X, and Detail / Source / Comments tabs (Detail: words,
      clause, tree; Source: checks, provenance; Comments: review trail).
      Supersedes the old-app rail styling of decision 27 (its order and
      groups stay).
- [ ] Q5 Canonical limb names for the other eighteen representations
      (Ben, 2026-09-13 21:25 UTC). After a few agreements have run (Metsera,
      Olaplex, Apogee at least), harvest the row_detail values the extractor
      produced per representation across those runs, cluster them, and put a
      proposed canonical list per representation to Ben in one note for his
      decision; then add them to `detail_labels_by_row` in generator decision
      31 and regenerate. Ben decides the names; the code only proposes.
- [ ] Q4 Decide with Ben whether legacy Query and Compare migrate to this
      read or are retired.

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
| Faster agreement processing and review | Deferred | After external launch | Shorter section and agreement processing, development feedback and future merger-agreement review, without reducing legal coverage, citation checks or required lawyer review. The former 90-minute launch limit is no longer mandatory, as Ben approved on 2026-09-06. | Use actual processing and review measurements to identify useful improvements. Apogee's ordinary processing baseline is 100 minutes 17 seconds, before lawyer review. Revisit measured model time, repeated input, retries and worker waiting. Compare combined checks within each existing section and safe parallel work. Do not infer section relatedness or omit context. Current small comparisons are recorded in Phase 5. |
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
