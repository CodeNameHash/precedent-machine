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
      Waits on V2 runs of Olaplex and Apogee. Dry run 2026-10-18
      (finding (122)): one command, `scripts/product/reconcile-ben-samples.js
      --notes olaplex|apogee --run <id> --out-dir <dir>`, proven end to
      end against Metsera generation 8 as a path check; three matcher
      defects fixed (the "III-INTRO" node name, "6.1" against "6.01",
      a subsection note reaching its section's facts).
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
      (Status 2026-10-23: the approach is stable, findings (227) to (234);
      the untouched agreement is Apogee on the Sonnet default, waiting on
      Ben's A or B of (235).)
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
      (162) 2026-10-18 20:25 UTC: implementer C's findings (120) to
      (124) accepted and merged (9035e952): the Q5 harvest and its
      note docs/codex-program/notes/Q5-REPRESENTATION-LIMB-NAMES-PROPOSAL-2026-10-18.md
      (558 readouts, 489 distinct limb names, 43 folds; the nine seeded
      rows carry canonical names on 64 of 78 facts, the 43 unseeded
      rows 442 names for 450 facts: the vocabulary is Ben's to fix);
      the Q4 note docs/codex-program/notes/Q4-LEGACY-QUERY-COMPARE-EVIDENCE-2026-10-18.md
      (legacy Query already off at every entry point, Compare reachable
      only by URL; retire is one deletion of about 36,000 lines, keep
      unrouted costs nothing now, migrate is a rewrite); the Phase 5
      reconciliation in one command with three matcher defects fixed
      (III-INTRO, leading zeros, the section-above rule); the 51
      UNRESOLVED fact types all from Exhibit-B, the Form CVR Agreement,
      never extracted because its closure records the exhibit's own
      section references as unresolved (47 of the 51 types carried
      VALID elsewhere; four absent as such in a cash deal). A's finding
      (93): 5.17's registration-rights covenants mis-rowed on the
      general covenants table and the stock consideration's securities-
      law statements on the capitalization table. To Ben: Q4 (retire
      now or keep unrouted; a Query on layered facts as a plan item
      once releases exist); Q5 (the note, row by row); A's (f) an
      obligor code for a party that is neither Company nor Parent and a
      "By when" column for covenant deadlines, (g) where the securities-
      law statements about the stock consideration belong, (h) an open
      row for a mutual condition the fixed list lacks. To A as work
      package 18's items (d) and (e): the Registration rights row with
      sub-items by words (labels proposed for Ben), and Exhibit-B's
      closure: references inside an exhibit resolve within the exhibit
      node (its own numbering) before the main agreement, so the CVR
      Agreement is extracted. NCS at 20:20 UTC: RUNNING, 85 of 104, 0
      failed, $127.17.
      (163) 2026-10-18 20:45 UTC, Ben's decisions, verbatim: "For CVRs
      - I want to build a separate product for that os I'd leave
      those"; "For query - we do need to build a query function etc but
      we should be thoughtful on how we do that once we have solid data
      we're happy with - add to the future planning (probably the first
      thing we build as it will drive the side bar etc)"; "Q5 - we need
      to get to canonical (and perhaps some of them are sub reps under
      a category) - wait untiil we have a few deals and see if we can
      AI it?"; "on A - if the shareholders have to do something, okay
      for them to be an obligor. Ok on ETA on covenants. reg rights I
      think goes with consideration (but at bottom)". Applied: work
      package 18 (e) is withdrawn; in its place an exhibit that is a
      separate agreement (a Form of CVR Agreement) is out of this
      product's scope: one OUT_OF_SCOPE_EXHIBIT note, no UNRESOLVED
      fact-type issue per family, no extraction call. Legacy Query and
      Compare stay unrouted (no deletion now); the Query on layered
      facts is a plan item under section 7's later features, first
      after the data is trusted, and implementer C writes its design
      note for Ben now (what the sidebar needs, the conclusions-cell
      filter across agreements, no code). Q5 waits for Olaplex and
      Apogee; then an AI pass proposes canonical names and the
      sub-representations under a category, for Ben's decision. A: an
      obligor code for a party that is neither Company nor Parent when
      the words bind it; a "By when" column on the covenant tables from
      TRIGGER and PERIOD; the registration-rights facts as a table at
      the bottom of the Consideration section, not on the covenants
      table; (h) stays as it is.
      (164) 2026-10-18 20:50 UTC: implementer A's (94) and implementer
      B's (100) to (104) merged to the working branch (fast-forward from
      origin; the active suite on the merged tree in the next finding).
      Read, not just counted. (94) (c): Metsera 6.08's seven
      model-written details become five lines in the shared vocabulary
      with nothing lost (the consent and its standard on one line; the
      consultation and the review-and-comment duty on one line), and
      NCS 5.14's twelve facts read as eight sub-items; improved, accepted.
      The ten publicity labels are proposals for Ben ("he decides the
      names; the code only proposes"); put to him with this check-in.
      (165) 2026-10-18 21:00 UTC: NCS generation 5 (run 51577c57) READY
      at 20:48 UTC: 1,037 proposals, 1,015 VALID, 22 held, 104 sections,
      393 model calls, 12.79m input (6.37m uncached, 4.68m cache reads,
      1.73m cache writes) and 3.80m output tokens, the pipeline's stored
      cost $145.68 (Ben's $200 credit; the projection of (160) was $150).
      Read, not just counted, in docs/codex-program/notes/
      NCS-GENERATION-5-AUDIT-2026-10-18.md: against generation 4's 850
      VALID and 145 held, every hold has a reason and a code rule (3.4's
      ten status representations cite the Article III chapeau on a span
      id one hex character from the closure's, the model's slip; 6.2's
      two bring-down tiers list cross-references; 6.4's three frustration
      facts cite "this Article VI" unresolved; the rest are work
      packages 14 and 18 (a) and (b), merged after this worker's wake);
      eight VALID facts have no readout (subtypes without a row); 25
      unusual provisions, ten of them genuinely unusual for Ben (the
      Tolling Period, the novation, the tax-deposit condition, the VAT
      warranty and mandatory election, Rewind). Work package 19 to
      implementer A: (a) to (d) the four rules above, (f) the
      registration rights as a table at the bottom of the Consideration
      section per Ben's (163), (g) finding (95)'s row move does not
      happen on the stored rows (29 facts stay on "General notification"
      with the sub-items; no "Registration rights" row), a defect to fix
      with the real rows pinned. The active suite on the merged head
      b77da65e: 757 of 758, the known failure only. The sandbox released
      (release_sandbox); pm-codex-preview-worker updated to b77da65e;
      pm-codex-preview-worker-2 created for the subscription provider
      (claude 2.1.302). Olaplex and Apogee generation 2 intakes on the
      environment's default provider: runs 686c3bf2 (1974640) and
      f1e2493f (1786205), QUEUED, woken next on the pool, per Ben's
      "Olaplex and Apogee run on the subscription, back to back/parallel".
      (166) 2026-10-18 21:05 UTC, Ben's decisions, verbatim. On the
      publicity sub-item names: "all sounds fine" (the ten labels of
      (167) 2026-10-18 21:15 UTC, Ben, verbatim: "do you think it is
      worth spooling an ageng to look at the cost of extractions/number
      of runs because it seems SO high ... I'm thinking like a 10-100x
      reduciton in cost"; then "I agree but I'd say get AS much cost
      reduction and increase in speed as possible." Applied: a fifth
      implementer, E (findings from (180)), on work package E1: the
      cost and time ledger from product_model_calls for NCS generation
      5 and Metsera generation 8, reconciled to the console's billed
      usage; the levers ranked by measured dollars and minutes (quotes
      as byte offsets, the cache, a cheaper model for routing and
      residual calls, the Batch API, max_tokens and part sizing,
      concurrency across sections and the pool, the idle gaps), proven
      on three NCS sections against the facts on the bytes before any
      deal; a replay harness that finalises a run from its stored
      responses with no model call (the "number of runs" answer); a
      cost and time gate per run. The manager's prior estimate, for
      the record: 10x is plausible from those levers; 100x is not while
      a frontier model reads every byte, and the finding must say what
      the next 10x would cost in facts.
      (168) 2026-10-18 21:40 UTC: implementer A's (97) and implementer
      B's (105) merged (head 4506eb2c; the active suite in the next
      finding). Correction to (165) (g): the manager's read of the
      registration rows was of the preview deployed before finding
      (169) 2026-10-18 21:55 UTC, Ben's intake order, verbatim: "apogee/
      crinetics/ centessa/ akero / alerkems / verve as the top ones".
      Applied: Apogee is generation 2 already running (run 686c3bf2);
      the other five submitted now as generation 1 intakes on the
      environment's default provider (the subscription), QUEUED with no
      worker, woken in Ben's order as a pool sandbox frees: Vertex /
      Crinetics, Lilly / Centessa (a UK scheme, filed as a Transaction
      Agreement; its Court-sanction mechanics are not the schema's,
      finding (127)), Novo Nordisk / Akero, Alkermes / Avadel (an Irish
      scheme), Lilly / Verve. The URLs are finding (127)'s verified
      Exhibit 2.1 links. The active suite on the merged head 4506eb2c:
      772 of 773, the known failure only.
      (170) 2026-10-18 21:58 UTC, Ben, verbatim: "I don't think we
      intake until E is done and we have reduced cost". Applied: no run
      is woken until implementer E's work package E1 has landed and the
      cost per agreement is down; the four intakes of (169) (Crinetics
      cd1d3e91, Centessa 436276fe, Akero 94cd879e, Avadel 91fe48a1) stay
      QUEUED with no worker and no model call; Olaplex and Apogee
      generation 2, already running on the subscription, continue. Two
      facts from the submissions, for later work: Verve's intake failed
      twice at structure build (STRUCTURE_PARENT_SPAN on span 4b477bbe,
      the Vercel function log), a structure defect on that exhibit for
      implementer A once E1 is in; and three of the four queued runs
      stopped at DOCUMENT_IDENTITY_REVIEW (the Phase 1 identity gate,
      product_phase1_resolve_identity), which needs the identity
      resolution before any wake; Avadel went straight to
      SECTION_ANALYSIS.
      (171) 2026-10-18 22:15 UTC: implementer B's (106) and implementer
      C's (128) merged (head 81203646; the active suite in the next
      finding). Read: the move script applies the 42 migrations to a
      named target in one transaction against Supabase's own ledger,
      carries one run's 36 tables in key order idempotently, and proves
      the three reads equal; its dry run on the preview branch shows
      each run's analysis and no release row, because no review is
      published yet. Manager's answer to B's question: the move runs
      after Ben's first review is published and activated on the
      preview branch, so it carries a release and not only analyses;
      Ben reviews on the preview deployment until then (his (166) "you
      can move over whener you like" stands as the authority for that
      apply, with --confirm-target). C's tender-offer and stock-deal
      rows accepted (eleven of 24 tender-offer provisions and five of
      21 stock-deal provisions had no row; now every one is reachable
      by row_label); what waits on Ben, put to him with this check-in:
      an Offer step with five subtypes, a MINIMUM_CONDITION subtype, an
      OFFER_FAILURE termination subtype, three LEGAL-RULES lines, the
      ratio's form and adjustment as grid columns, a combined-company
      governance table, Parent's no-shop, a Dividends table. Next:
      work package B4 to implementer B, Verve's intake failure
      (STRUCTURE_PARENT_SPAN on span 4b477bbe at buildAgreementStructure,
      twice, finding (170)), a structure defect to fix in code with the
      exhibit's own bytes pinned; work package C5 to implementer C, the
      DOCUMENT_IDENTITY_REVIEW gate the Crinetics, Centessa and Akero
      intakes stopped at: the recorded reasons, the resolution the
      Phase 1 function wants, and whether the page shows them, for the
      manager to resolve with Ben. Olaplex and Apogee generation 2 at
      22:12 UTC: 24 of 97 and 21 of 85, no failures.
      (172) 2026-10-18 22:30 UTC: implementer E's (180), implementer A's
      (173) 2026-10-18 22:55 UTC: implementer B's (107), implementer C's
      (174) 2026-10-19 02:15 UTC: the 23:26 check-in reached the manager
      at 02:10 (the session was idle). The active suite on the merged
      head 49d0bc59: 780 of 781, the known failure only. At 02:11 both
      subscription runs were PARTIAL with no worker: Olaplex/Apogee
      686c3bf2 at 33 of 97 (3.20 part 2 of 3 and 3.22 FAILED, attempt 1
      of 3) and f1e2493f at 30 of 85 (3.18 part 2 of 5 and 3.20 FAILED),
      every failure "claude exited 1: API Error: This request would
      exceed your account's rate limit" between 22:49 and 22:59 UTC,
      and every implementer session (A to E) stopped at the same hour
      with "You've hit your session limit, resets 2:10am (UTC)". One
      cause: the subscription's five-hour window is shared by the two
      extraction workers and the five implementer sessions, and the
      implementers' Fable use spent it. Retried both runs at 02:15
      (olaplex-apogee-a-retry-1, -b-retry-1; nothing new woken, Ben's
      (175) 2026-10-19 02:25 UTC, Ben: "What do you think? Do we hope we
      can just get it all done in this window?"; the manager's answer:
      no; the open work is two or three five-hour windows even with
      nothing else running (the two deals about five hours of worker
      time; E's levers more than one window; A, B, C and D one to two
      hours each), and the implementers are the path to cheap intake;
      recommended the implementers first and the two deals paused, the
      completed sections kept, resumed in a quiet window. Ben: "Ok".
      Applied: the workers on pm-codex-preview-worker and
      pm-codex-preview-worker-2 stopped and both sandboxes released from
      the pool; runs 686c3bf2 and f1e2493f stay PARTIAL with their
      completed sections (33 and 30) until the manager retries them in
      a window the implementers are not using; B and C go idle after
      B5 and C6 so that A, D and E alone draw on the window.
      (176) 2026-10-19 02:55 UTC: implementer E's (181) and (182),
      implementer A's (200), implementer B's (108) and implementer C's
      (177) 2026-10-19 03:05 UTC, Ben, verbatim: "I'd push e again to
      say it should imagine itself like a nasa engineer in Apollo 13,
      having to figure out how to get all required performance on even
      less juice and even quicker. It can experiment, tear up ideas
      etc. cone at completely fresh. And be implanting its existing
      ideas now too". Applied to implementer E: (1) the stack that
      needs no proof (the answer format with span aliases, anchored
      quotes, the contracts in one or two stable blocks, eight section
      loops with a split section's parts together, routing and
      residual on Haiku 5.5, nothing on uncommitted attempts, and Opus
      5.5 for extraction if the reference confirms it on both
      providers) becomes the default request profile for every new
      run now, behind the model-config identity, the paused and
      finished runs keeping theirs; medium effort and the cached
      agreement wait for the ablation; (2) then a fresh sheet: every
      assumption of the pipeline questioned (one call per section with
      its whole closure; three model passes; a frontier model for every
      call; the agreement's words written back; one answer per section;
      the worker loop; 64-hex identities on the wire), each with an
      experiment the ablation job can run and the expected saving by
      the ledger's method, the deterministic ones built behind flags
      now. The required performance is the facts as read now, judged by
      compare-generations on the agreement's bytes. Findings from (184).
      (178) 2026-10-19 03:35 UTC: implementer D's (142) and (142a) and
      implementer A's (201) merged (head 25423061; the active suite in
      the next finding). D3 read: an attempt resumes after a worker
      stop (completed calls of an interrupted attempt reused at zero
      cost under the new attempt's identity, every failure record on
      the history carrying its attempt token and part, the lease
      recovery writing the expired attempt, a stopping worker handing
      its claim back with the parts done, a restarted worker releasing
      its own dead claims); a second gap found and fixed on the way
      (work package 15's part failure never reached the section's
      history on the hosted path, so the re-split by part of (84) and
      (179) 2026-10-19 04:10 UTC: implementer E's (183), (184) and (185)
      merged (head 29e22ce5; the active suite in the next finding).
      Read: (183) the ablation job through the deployment's wake path
      (POST /api/product/ablation, the internal bearer alone, the
      experiments sandbox pm-codex-preview-worker-3 outside the run
      pool, the launcher dumping the snapshot on the sandbox and
      writing under /vercel/sandbox/pm-ablation-<timestamp>/, nothing
      to the product tables; the CLI path measuring what the CLI
      reports and listing the rungs it cannot express rather than
      faking them). (184) the stack that needs no proof is the default
      request profile for every new run on both providers (span
      aliases, anchored quotes, two stable blocks, eight section loops
      with a split section's parts four at a time, Haiku 5.5 routing
      and residual, Opus 5.5 extraction on the API where the reference
      lists it at $4 and $20; Opus 5 on the CLI until the ablation's
      rung confirms 5.5 there), behind the model-config identity, the
      paused and finished runs keeping theirs; NCS generation 6 on it
      projected by the ledger's method at about $72 and 70 wall minutes
      against $145.68 and 439. (185) the fresh sheet: eleven
      assumptions, five built behind flags (deterministic routing where
      the headings and anchoring terms decide, routing calls 118 to
      about 40; direct definitions, 16.36 MB to about 7 MB; the fact
      budget; Sonnet 5.5 writing the facts as a rung; the default rung)
      and the rest designed with their cost (the residual skip, the
      statement from the components, NDJSON facts, the Batch API's
      waves, section batching). Stacked by E: the built rungs that
      hold take $72 to about $55, the model tier and the Batch API to
      about $12, Ben's 10x, the facts judged by compare-generations at
      every step. One structural limit stated: product_section_routings
      needs its model_call_id before a hosted run can take
      deterministic routing (a migration, implementer D's). Accepted.
      Next: pm-codex-preview-worker-3 created for the CLI provider and
      the ladder started on NCS generation 5's 3.19, 5.2 and 5.17 in
      E's order (default, deterministic_routing, direct_definitions,
      fact_budget, anchors_sonnet55, offsets, trimmed) once the
      deployment carries (183).
      (210) 2026-10-19 06:40 UTC (the manager's numbers from (210);
      (180) to (199) are E's, (200) on A's): the first ablation ladder
      is DONE (job pm-ablation-20261019T040851Z, the experiments sandbox
      on the subscription, NCS generation 5's 3.19, 5.2 and 5.17,
      seventeen variants, 04:08 to before 06:34 UTC, exit 0; the table
      and the manager's reading in docs/codex-program/notes/
      ABLATION-LADDER-RUN-1-2026-10-19.md). Read, not just counted:
      Opus 5.5 holds the facts (7 of 7, 26 of 27 with one partial, 41
      of 41) and the subscription has it (the default rung ran it);
      Sonnet 5.5 holds them too (6 of 7 with one partial, 26 of 27
      with one partial, 41 of 41) at about 2.3x the stored run's speed
      and two thirds of its output tokens; the answer format holds
      (the best row, 7, 27, 41 with no partial); offsets lose facts
      (5 of 7 and 23 of 27) and are out; the trimmed context and the
      direct definitions each lose one fact on 5.17 and need one more
      look. Three defects in the ladder itself, to E as work package
      E4 before the second run: the recording key carries neither the
      model nor the effort, so the anchors rungs for medium effort and
      Opus 5.5 replayed the Sonnet answer and were never run (medium
      effort is still unmeasured); the cost and thinking columns
      accumulate across the ladder; the replay rungs missed on byte
      identity, fixed by (186), deployed at 1e468325 after the job
      started. The second run measures baseline, deterministic
      routing, the two routing-model rungs and the four anchors rungs.
      The experiments sandbox is being updated to head for it. The
      two deals stay paused.
      (88) never fired there). Migration 20261019003000 applied to the
      preview branch at 03:33 UTC; the pool sandboxes are updated to
      head after this push, while no worker holds their lock. (201)
      corrects (176): A's proof is that today's compile of NCS's stored
      answers by quotes, by offsets (1,063 of 1,066; 4.7's three lose
      their introduction components under the offsets rule) and by
      unique anchors (1,066 of 1,066) gives the same facts and the same
      22 holds, not that the stored statuses re-validate. The two
      paused runs: no live sandbox assignment, two stale RUNNING rows
      each with leases lapsed at 02:43, released on the next wake by
      D3's restarted-worker rule.
      (130) merged (head 42f536d2; the active suite in the next
      finding). Read: E's levers ranked with measured dollars on NCS
      generation 5 (the answer format with span aliases -$28 and -107
      minutes; eight section loops -280 minutes; medium effort -$17 if
      the facts hold; Opus 5.5 -$29; the cached agreement -$6; anchored
      quotes -$9; two stable blocks -$7; routing and residual on Haiku
      -$5; the uncommitted attempts -$14 already fixed), stacked to
      about $66 (2.2x) with nothing the ablation must prove, about $42
      (3.5x) with medium effort and the cached agreement if the facts
      hold, about $21 (7x) with the Batch API runner still to build;
      10x needs every step; the next 10x is a smaller model writing the
      facts, unmeasured. Built: the replay harness (a run finalised
      from its stored responses, zero calls; the Concho proof in the
      tests, the NCS generation 5 proof for the manager where the
      branch keys are), the lean request profile behind the model-config
      identity, the three-section ablation harness with its ladder
      (3.19, 5.2, 5.17; eleven variants), the gate. A's (200): the
      validator reads absolute byte offsets, E's lean aliases and
      eight-hex prefixes, and the stored NCS answers re-validate to the
      same 1,015 and 22. C's (130): the four identity rules pinned on
      fourteen agreements. B's (108): the pre-intake structure check
      as a script over the 34 deals. The ablation's live ladder is
      not run yet: its snapshot needs the branch keys and its calls the
      provider credentials, neither in this session, and at API rates
      the eleven-variant ladder on three sections is tens of dollars of
      Ben's remaining credit. Decision: the ladder runs on the
      subscription provider on a third sandbox, pm-codex-preview-worker-3,
      through the deployment's own wake path so no credential is read
      here (work package E2 to implementer E: an ablation job on the
      sandbox wake, internal-token protected, writing its outputs to
      the sandbox log and nothing to the product tables), in the next
      window the implementers are not using, before the two paused
      deals resume. The two paused runs read RUNNING with two stale
      leases each until the leases lapse; no worker is alive on either
      sandbox.
      (170) stands) and every implementer re-triggered on its open
      package. For Ben: while the implementers run on the subscription,
      the two deals and the five sessions compete for one window; the
      order of use is his to set (the runs first, the implementers
      first, or the deals on the API once E's levers land).
      (129) and implementer D's (141) merged (head 49d0bc59; the active
      suite in the next finding). Read: (107) the Verve failure was a
      sectionizer rule parenting "Annex I" to ARTICLE I by numeral
      alone; seven of the 42 biopharma exhibits failed on it (every
      two-step tender offer with a trailing conditions annex) and two
      more carried an annex's limbs as the last section's; 42 of 42
      build now, pinned on Verve's own bytes. (129) the three intakes
      held at the identity gate are parser misses on sound documents
      (a cover date with a trailing comma; a compound parenthetical; a
      name class without "/"; "among:" with a colon), not doubts about
      the document. (141) every CI database test on the full migration
      list through one harness, 40 of 40 on Postgres 16, the workflow
      on pushes to both branches; no migration defect. Work packages
      sent: C6 (the four parser rules, pinned on the three exhibits,
      swept over the 34), D3 (parts committed as they complete, an
      attempt resumed after a worker restart, no silent loss; E's
      ledger put $13.84 and 69 call-minutes of NCS generation 5 on
      attempts that never committed), B5 (the pre-intake structure
      check as a script, run over the 34). Olaplex and Apogee
      generation 2 at 22:49 UTC by SQL: 31 of 97 and 28 of 85, no
      failures (the preview share cookie expired at 22:49; the share
      link no longer admits the API, so the status is read by SQL
      until a new share link or bypass is in hand). Implementer A was
      at its five-hour limit at 22:49 (resets at 22:50) with work
      package 21 in progress.
      (98), (99) and (99a) merged (head 5f1785ca). The ledger read by
      the manager, not just its totals: the per-call costs reconcile
      to the published rates to the cent; output is 63 per cent of
      NCS generation 5's $145.68 (3.69m extraction output tokens at
      87 a second are 97 per cent of call time), of the visible answer
      30 per cent is the agreement's words written back twice, 20 per
      cent 64-hex span ids, 12 per cent the V1 roles the page never
      shows; fresh input is 20 per cent (every agreement byte sent at
      least three times, a fifth of the bytes 119 to 277 times each,
      74 per cent of 16.0m byte-sends); cache writes 12 per cent (51
      distinct stable blocks, 22 used once); failed attempts 9.5 per
      cent; 62 of 439 minutes idle. Floor: about $15 to $23 and 13
      minutes in parallel; actual 6x to 10x the cost floor and 34x the
      parallel time floor. The manager's (167) estimate holds: 10x is
      there, 100x is not while a frontier model writes the facts.
      Direction to E, in order of measured dollars: output (drop the
      duplicate evidence quotes and the V1 roles, span aliases, quotes
      as byte offsets, the thinking share measured by effort), then
      input (one stable block for every call, the definitions article
      and the most-referred sections as cached context, cross-reference
      depth capped), then what remains of the failed attempts and the
      idle, then concurrency; the three-section proof as a script run
      inside a third sandbox created for experiments, the credentials
      never read here. Work package 21 to A (findings from (200)): the
      validator's acceptance of offsets and span aliases, proven on
      the stored rows. A's (99) corrects (171): the registration row
      shape the manager saw was real on the deployed code too (the
      subtype naming overrode the words rule on the same table), fixed
      and pinned. Olaplex and Apogee generation 2 at 22:12 UTC: 24 of
      97 and 21 of 85, no failures.
      (95)'s rule reached the deployment (its deploy was created at
      20:50:39 UTC, the read fell between READY at 20:48 and that);
      on the real rows the move happens, now pinned with the stored
      5.17 rows in tests/fixtures/product/ncs-generation-5-5-17-
      general-covenants.json. Accepted: the registration-rights table
      as one line under Consideration, no sub-items, per Ben's (166);
      the PARTY_NOUN and TIMING_WORDS rules the real rows forced; the
      LIST-of-references and SELF_REFERENCE rules (five NCS holds VALID
      on the next generation). B's comparison on generation 5: 12 V1
      facts without a counterpart (11 held by V2 with the fact
      extracted, one a chapeau), none a miss; seven V2 defects ranked.
      Of them, (1) to (4) are in the code since work packages 13 (a),
      14, 18 (b) and 19; the new ones go to implementer A as work
      package 20: B's rule that an inherited context component which
      fails to resolve is dropped with a note rather than holding a
      fact whose own components resolved; (5) a quote across an SEC
      page footer matched with the footer tokens skipped (4.7, 5.4);
      (6) the fused "has not taken any action" and "knows of no fact"
      representations split by the one-effect rule (3.27, 4.13); (7) a
      filing exception of a no-conflicts representation as an EXCEPTION
      component, not its own fact, unless the family's table has a row
      per exception (3.5, 4.4, 5.1). Olaplex and Apogee generation 2 at
      21:35 UTC: 16 of 97 and 10 of 85 sections, no failures, on the
      subscription (slower than the API: about 25 sections an hour
      across the two sandboxes). Implementer E started on work package
      E1 at 21:22 UTC.
      (94) (c) are final). On the registration-rights sub-items: "are
      these from a reg rights agreement? I wouldn't go into anywhere near
      this depth in this product" (they are NCS 5.17, a registration
      covenant inside the merger agreement, not a separate agreement;
      applied: registration rights is one row at the bottom of the
      Consideration section, present or absent with the as-drafted
      summary and its facts behind it, no sub-items; the seven labels of
      (95) are withdrawn). On the ten unusual provisions: "not a fact
      type today". On the production project: "I'm not sure what you
      mean but I don't care boaut the old site, you can move over whener
      you like" (applied: the move of the product schema and the
      reviewed rows to the production project is approved in principle;
      implementer B prepares it as a script with a dry run and a report,
      the manager runs it after reading the dry run; the released Review
      still publishes only a review every item of which Ben decided).
      On the next deals: "btw let's do major biopharma deals as the
      basi sfor the build out of next searches, starting > $1bn"
      (applied: after Olaplex and Apogee, the intakes are public-target
      biopharma merger agreements over $1bn; implementer C compiles the
      candidate list with each Exhibit 2.1 URL for Ben to order).
      (94) (a) and (b) are finalisation rules: NCS generation 5's worker
      runs the code of its wake (18:55 UTC), so 4.7's three inherited
      quotes and 5.11's reference premium stay held in that run and are
      VALID on the next generation; the generation 5 audit says so.
      Manager answers to B: (100) the released Review for this internal
      launch runs on the preview branch behind deal-corpus-preview;
      the production project is a later cutover that only Ben approves
      (his standing rule), nothing built for it; (103) option (a), the
      rollback drill runs on the second release, after Ben's first
      correction, no migration; (104) accepted, work package D2 to
      implementer D (every CI database test on the full migration list;
      the workflow also on pushes to the two working branches). Work
      package B2 to implementer B: the NCS comparison regenerated with
      generation 5 once READY, and the 102 V1 facts without a
      counterpart read one by one into a ranked list of V2 extraction
      defects with the rule or prompt line for each (finding (105)).
      (211) 2026-10-19 09:10 to 09:30 UTC (the manager): the second
      ablation ladder is DONE (job pm-ablation-20261019T071955Z, the
      experiments sandbox at d94f55a7 with E's (188), NCS generation 5's
      3.19, 5.2 and 5.17, nine rungs, 07:19 to 08:54 UTC, exit 0; read
      and priced in docs/codex-program/notes/ABLATION-LADDER-RUN-2-2026-10-19.md).
      Run 1's three defects ((210)) are fixed: every anchors rung ran
      live on its own model and effort, the columns are per section,
      and `baseline` reads the stored run back with no call (7 / 27 /
      41 matched), so the replay harness is a zero-call control. The
      live rungs, the same words (the ANCHORS profile) on four model
      and effort pairs, against the stored 75 facts, with cost priced
      on one cache layout for every row (every input token a one-hour
      cache write; the read-layout figure in the note): Opus 5 high
      (`anchors`, and `all_contracts`, which on the CLI is the same
      configuration) 74 matched, 1 partial, 238,915 output tokens,
      3,219 serial seconds, $12.97; Opus 5 medium 70 matched, 3
      partial, 2 unmatched, 129,975 output, 1,664 s, $10.25; Opus 5.5
      high 74 matched, 1 unmatched, 244,520 output, 2,711 s, $10.49;
      Opus 5.5 medium 73 matched, 1 partial, 1 unmatched, 156,771
      output, 1,716 s, $8.74; Sonnet 5.5 high (run 1's row, same
      words) 73 matched, 2 partial, 191,519 output, 1,609 s, $4.72;
      the stored run 261,884 output, 3,006 s, $13.48 on that layout
      and $9.49 as billed. The one fact Opus 5.5 does not write, at
      either effort, is 5.17's "Specified Stockholder's indemnity
      liability capped at net proceeds from its Registrable Securities
      sale", a registration-rights sub-item Ben's (167) takes out of
      the product; its anchors resolved, so the model omitted it. Opus
      5 medium's second loss is the Registration Statement fact whose
      first words cross the page footer "57" (`anchors_unresolved: 2`;
      A's (202) fixed that after this job started). The routing rungs
      replayed the stored extraction and so measure routing agreement
      only (Sonnet 5.5 and Haiku 5.5 at low effort route 3.19 and 5.17
      narrower than the stored run); not fact evidence. Two defects
      for E (work package E5): `deterministic_routing` and
      `routing_haiku` fail 5.17 with GROUP_FAMILY (part1:g1, part3:g1)
      when the routing differs from the stored run's part grouping,
      instead of a live call or a REPLAY_MISS; and the job table's cost
      column follows the CLI's reported cache split, so one rung's
      figure depends on what the rung before it sent (price every rung
      on the two fixed layouts). Put to Ben, the tier decision with the
      numbers above: Opus 5.5 at medium effort (half the stored run's
      cost and seconds, one cut fact missing, one partial), Sonnet 5.5
      at high effort (a third of the cost, two partials, no loss), or
      Opus 5.5 at high effort (one partial fewer than medium for 56%
      more output); and the manager's recommendation that the default
      changes only after one full agreement runs on the chosen tier
      against its stored generation (97 sections, not three). The two
      deals stay paused ((175)); no intake ((172)). A's (202) merged at
      d627ace1; npm run test:active on the merged tree in this finding's
      commit.
      (212) 2026-10-19 10:15 UTC (the manager; Ben's decision): on the
      tier question in (211), Ben: "Sonnet makes sense". So the
      extraction model becomes claude-sonnet-5-5 at high effort on the
      ANCHORS words (run 1's and run 2's anchors_sonnet55 rows: 73
      matched, 2 partial, none lost of 75; 73% of the stored output
      tokens, 54% of the seconds, about a third of the cost), subject
      to the full-agreement confirmation E's (189) harness is built
      for: every section of NCS generation 5 on anchors_sonnet55
      against the stored generation, on the experiments sandbox, with
      E's --estimate read first. The default profile changes only when
      that run's totals row holds (the manager reads it and writes it
      into a finding; a lost fact a lawyer keeps goes to Ben by name).
      Work package E6 to E: the estimate, then the run, with the Sonnet
      variants of derived_statement and merged_residual ((190)) in the
      same job if the estimate fits the window, else after. The two
      deals stay paused ((175)) and no intake ((172)) until the default
      is changed and the pool workers carry it.
      (213) 2026-10-19 10:50 UTC (the manager): E's (189) and (190)
      merged and the suite on 213470a4 run whole: 841 tests, 840 pass,
      the known Codex final-message failure only (the SEC timing test
      passed here). E's (190) hands the Batch API design (the ledger
      note's section 15) to implementer D for the hosted worker; held,
      not packaged, until the full-agreement confirmation ((212), E6)
      is DONE: D's session and the experiments sandbox draw on the
      same five-hour window, the design is for the API provider, which
      the paused pool runs do not use, and the worker change is better
      written once the Sonnet default is settled, since the batch
      waves carry the default's call-kind map. E6 at 10:47 UTC: E's
      suite running before its push; the confirmation job not yet
      started (the sandbox lists the two ladder jobs only). The two
      deals paused ((175)); no intake ((172)).
      (214) 2026-10-19 11:27 UTC (the manager): the Sonnet confirmation
      job fired through the ablation route, E's (191) order (the
      confirmation alone first; the two Sonnet levers as a second job
      after it): job pm-ablation-20261019T112716Z on the experiments
      sandbox pm-codex-preview-worker-3, run 51577c57 (NCS generation
      5), sections all, variant anchors_sonnet55, the deployment READY
      at 80a76cd1 (E's E6 merged), E's estimate about 12.8m input and
      2.77m output tokens of the subscription and about 66 minutes.
      E's prepared default commit (244acaa, local to E) stays unpushed
      until the manager reads the whole-agreement totals row ((212)).
      E's (191) could not fire the job itself: that session holds
      neither the internal bearer nor the sandbox credentials, by
      design; the manager fires and reports. The two deals paused
      ((175)); no intake ((172)).
      (215) 2026-10-19 12:20 to 12:30 UTC (the manager): the
      confirmation job of (214) failed at launch twice before it ran.
      First, pm-ablation-20261019T112716Z, "sections not in the run:
      all" in five seconds: the experiments sandbox runs its own
      checkout (/vercel/sandbox/pm-product, the job log's commit),
      which stood at de9c01e1 from before E's (189), so the word 'all'
      was unknown there; the deployment's head is not the sandbox's.
      Updated with scripts/product/update-sandbox-worker.js --name
      pm-codex-preview-worker-3 to abfd3c1e. Second,
      pm-ablation-20261019T122058Z, "product_fact_components: " (an
      empty message) in 27 seconds: scripts/product/cost-ablation.js
      asks for the components of every proposal of the wanted sections
      in one `in` filter, and NCS generation 5 whole has a thousand-odd
      proposal ids, more than the database's request length takes;
      three sections never reached it. Fixed in lib/product/run-rows.js:
      a list filter longer than 150 values goes in chunks and the
      pages are joined in the table's order (`IN_FILTER_CHUNK`; pinned
      in tests/product-run-rows.test.js: 307 ids in three queries, the
      rows whole and ordered). Pushed at fa205b1f, the sandbox updated
      to it, and the job fired a third time: pm-ablation-20261019T122404Z,
      RUNNING at 12:26 UTC, its first section 8.7 matched 2 of 2 on
      Sonnet 5.5 at high effort. E's (192) (`fact_lines`, row 7 of the
      fresh sheet, nothing run) merged. The two deals paused ((175));
      no intake ((172)); 244acaa held.
      (216) 2026-10-19 15:10 to 15:40 UTC (the manager): the Sonnet
      confirmation is DONE (job pm-ablation-20261019T122404Z, 12:24 to
      about 15:15 UTC, exit 0; read in
      docs/codex-program/notes/SONNET-CONFIRMATION-NCS-2026-10-19.md).
      Every section of NCS generation 5 on anchors_sonnet55
      (claude-sonnet-5-5, high effort, the ANCHORS words): of the 971
      stored facts in the 102 sections that answered, 931 matched, 20
      partial (the same fact in fewer words), 20 unmatched; 935 VALID
      and 18 held written, 86 new; 2,224,248 output tokens against the
      stored 3,473,680 (64%), 15,033 serial seconds against 39,968
      (38%), $62.11 with every input token a one-hour cache write and
      $24.24 with every one a read, about $41 on the stored run's own
      layout against its $133.64 as billed. Two sections failed on one
      call each and are not in those columns (5.17, 41 stored facts,
      CLAUDE_PRODUCT_JSON on part 3 of 5; 3.10, 3 stored,
      MODEL_RESPONSE_SHAPE proposal.client_ref): attempt failures the
      pipeline retries and the ablation at fa205b1f did not; E's (193)
      retry is on the sandbox now. The twenty unmatched, read one by
      one: ten are facts Sonnet wrote that the validator held on
      INVALID_FACT_COMPONENTS "CROSS_REFERENCE must resolve" (4.1 seven
      of its 18, 3.1 three): the MAE carve-outs, carve-backs and the
      underlying-cause restoration, which the stored Opus 5 wrote
      VALID. Sonnet's component is a CROSS_REFERENCE whose text is the
      definition's own clause numbers, "clauses (1), (2), (3), (4) and
      (7)" or "this clause (10)", with resolves_to null (the components
      as written are in
      docs/codex-program/notes/sonnet-confirmation/sonnet-held-proposals-ncs5.json);
      the resolver has no target for an intra-definition clause
      number. Work package 22 to implementer A: read Opus 5's form for
      the same facts, teach the resolver the clause-number form where
      it is a legitimate reference, or the contract the form the
      resolver takes; also the four empty-quote holds (5.16, 3.18 twice,
      4.10) and whether 3.2's three new facts carry the qualifiers.
      About eight are the model's omissions: four
      REPRESENTATION_QUALIFICATION facts (3.1 and 3.2, the Disclosure
      Letter and SEC Documents qualifiers to the representations), 1.2
      the Closing Date sentence, 2.1 the Delaware-law conversion, 2.3
      the Exchange Fund and the ten-day VWAP cash in lieu of fractional
      shares; the qualifiers and the fractional-share mechanics a
      lawyer keeps, put to Ben by name as (212) promised. The rest of
      the twenty are the other INVALID_FACT_COMPONENTS holds (one LIST
      without elements on 3.2, one unparsable "an amount in cash" on
      2.3, the empty quotes). Ben's tier holds: the whole-agreement
      loss to the model is under one per cent, and the held facts are
      a code fix. The default changes (E's 244acaa) after A's resolver
      change and the variance job fired at 15:18 UTC
      (pm-ablation-20261019T151819Z: 3.1, 4.1, 3.2, 2.3, 4.10, 3.10 and
      5.17 on anchors_sonnet55 and anchors_opus55_medium, three
      sections at once, the sandbox at 7c82fea4 with (193)'s retry),
      which says whether the 3.1 and 4.1 holds repeat and whether Opus
      5.5 medium writes the reference the same way. The two deals
      paused ((175)); no intake ((172)).
      (217) 2026-10-19 15:54 UTC (the manager): the variance job of
      (216) is DONE (pm-ablation-20261019T151819Z, 15:18 to 15:54 UTC,
      the sandbox at 7c82fea4, three sections at once, E's (193) retry
      on; the seven sections that lost facts or failed in the
      confirmation: 3.1, 4.1, 3.2, 2.3, 4.10, 3.10, 5.17; 151 stored
      facts). anchors_sonnet55 again: 126 matched, 13 partial, 12
      unmatched, 8 held; 322,725 output tokens. anchors_opus55_medium:
      142 matched, 3 partial, 6 unmatched, 1 held; 308,371 output
      tokens, fewer than Sonnet's. Section by section, Sonnet against
      Opus 5.5 medium: 3.1 14 / 2 / 8 (6 held, CROSS_REFERENCE must
      resolve) against 20 / 1 / 3 (1 held); 4.1 17 / 1 / 0, no hold,
      against 17 / 1 / 0 (so Sonnet's seven holds on 4.1 in the
      confirmation did not repeat: whether it fills resolves_to varies
      run to run); 3.2 17 / 8 / 2 (the eight partials the
      capitalisation numbers in fewer words) against 25 / 0 / 2; 2.3
      34 / 2 / 1 against 35 / 1 / 1; 5.17 40 / 0 / 1 (the retry
      recovered the section that failed whole in the confirmation; the
      one lost the registration-rights indemnity cap (167) cuts)
      against 41 / 0 / 0; 3.10 and 4.10 whole on both. The facts the
      model itself omits are the same five on both tiers and on all
      three runs so far: the four REPRESENTATION_QUALIFICATION facts
      (3.1 and 3.2, the Disclosure Letter and SEC Documents qualifiers)
      and 2.3's Exchange Fund definition; the stored Opus 5 at high
      effort wrote them, the cheaper tiers do not: a contract
      instruction matter (A's work package 22 item 4), not a tier
      matter. Sonnet's other losses are the resolves_to holds A's
      resolver change recovers, and its partials are the same facts in
      fewer words. Reading: with A's change in, Sonnet 5.5 and Opus
      5.5 medium match the same facts on these sections; Opus 5.5
      medium writes fuller statements (3 partials against 13) and
      holds steadier run to run, at about twice Sonnet's price and
      about half the stored run's. Ben's tier stands unless he weighs
      the fuller words; to give him the whole-agreement number for the
      alternative, pm-ablation-20261019T155504Z fired at 15:55 UTC:
      every section on anchors_opus55_medium, four sections at once
      ((193)'s loops, their first use), about an hour. E's second job
      (the two Sonnet levers) goes after it. The two deals paused
      ((175)); no intake ((172)); 244acaa held.
      (218) 2026-10-19 16:50 UTC (the manager): the default extraction
      model is Sonnet 5.5 at high effort, Ben's (212), merged at
      a38df6be from E's E6 commit (finding (195)): a fourth API config
      (PRODUCT_ANTHROPIC_API_CALL_KIND_MAP/V4) and a third CLI config
      (PRODUCT_CLAUDE_CLI_CALL_KIND_MAP/V3), claude-sonnet-5-5 high for
      EXTRACTION, Haiku 5.5 low for ROUTING and RESIDUAL, the DEFAULT
      and DEFAULT_CLI profiles, Ben's words verbatim in the code
      comment; the Opus 5.5 configs stay reachable by the name OPUS
      and a run created under V3 or V2 advances under it. The gate
      (212) set was met: the whole-agreement confirmation read ((216)),
      A's resolver change for the clause-number cross-references
      merged ((203), f47dedb0), the variance job read ((217)), and A's
      request instruction naming the qualification facts and the
      Exchange Fund fact merged (a8656b3c; the facts return per
      section as Opus wrote them, the placement still Ben's question).
      npm run test:active on the merged tree in this finding's commit.
      Not yet done: the pool sandboxes (pm-codex-preview-worker, -2)
      still run 23c6ef56 and carry the old default; they are updated
      with scripts/product/update-sandbox-worker.js when Ben says the
      two paused deals resume ((175)), so a resumed attempt runs on
      Sonnet. The Opus 5.5 medium whole-agreement job
      (pm-ablation-20261019T155504Z) runs on for the record; E's second
      job follows it. No intake ((172)).
      (219) 2026-10-19 17:00 UTC (the manager): the Opus 5.5 medium
      whole-agreement job (pm-ablation-20261019T155504Z, four sections
      at once, the first use of (193)'s loops) ended partial: 35 of 104
      sections answered, 69 failed on the subscription's five-hour
      limit ("You've hit your session limit", the window the
      implementer sessions and the sandbox share, resetting about
      17:10 UTC). The 35 that answered: 422 matched, 2 partial, 22
      unmatched of 446 stored, 449 VALID and none held, 50 new,
      985,474 output tokens; 3.1 22 of 24 and 3.2 25 of 27 (the same
      five omitted facts as (217)), 5.17 40 of 41, and 5.1 48 matched,
      1 partial, 17 unmatched of 66, which the Sonnet confirmation
      held at 63 / 3 / 0: not read yet (whether a part of 5.1 met the
      limit mid-section or Opus 5.5 medium dropped the interim
      covenants), and the only row in this run that would weigh
      against the tier reading of (217). The table is kept in the
      manager's scratchpad; the sandbox's job directory holds the
      rows. 5.1 read at 17:20 UTC: four live calls, none at the
      limit; parts 1 and 3 came back with 2,079 and 4,429 output
      tokens against 22,739 and 92,153 for parts 2 and 4, and the 17
      lost are part 1's facts whole (the ordinary-course and
      reasonable-best-efforts affirmative covenants, the consent
      standards, the Disclosure Letter, Agreement and Law exceptions):
      Opus 5.5 at medium effort under-wrote two parts of the longest
      section where Sonnet 5.5 at high effort wrote 63 of 66. That
      weighs for Ben's tier, not against it. The window reset at 17:10
      UTC; the sandbox updated to eadfaaa6 and E's second job fired at
      17:16 UTC: pm-ablation-20261019T171620Z (derived_statement_sonnet55,
      merged_residual_sonnet55, every section, four at once, (193)'s
      retry on: the rows carry "attempts"); the Opus 5.5 medium
      remainder only if Ben wants the fuller-words comparison
      completed. The two deals paused ((175)); no intake
      ((172)); the pool sandboxes still on the old default until Ben
      says resume.
      (220) 2026-10-21 21:00 UTC (the manager, on Ben's "Restart"):
      the loop stopped on 2026-10-19 between 18:28 and 18:35 UTC when
      the implementer sessions A and E and the subscription sandbox
      all met the account's weekly limit ("You're out of usage
      credits"; "You've hit your weekly limit"), which reset on
      2026-10-21 at 18:00 UTC; the branch stood at 4c4e918c throughout
      (suite 850 of 851, the known failure). E's second job
      (pm-ablation-20261019T171620Z, finding (219)) ended at 19:31 UTC
      on 2026-10-19, exit 0, read now from the sandbox:
      derived_statement_sonnet55 answered 96 of 104 sections, 818
      matched, 14 partial, 11 unmatched of 843 stored (the same
      omitted facts as (216) and (217), plus III-INTRO's three and one
      on 6.1), 823 VALID and 8 held, 1,844,268 output tokens where
      anchors_sonnet55 wrote 2,224,248 on 102 sections (about 17 per
      cent fewer per section: the statement no longer written back);
      eight sections failed after the retry, six on
      MODEL_RESPONSE_SHAPE (5.17, 5.11, 3.15, 2.5 and 3.13 on
      proposal.evidence_quotes[].source_span; 5.1 on
      proposal.statement) and two on FACT_LINK_ENDPOINT (4.12 p3c1:p3,
      3.3 p2c1:p2), where the confirmation lost two: the derived mode
      trips shape checks the plain mode does not, E's to fix before it
      is a default ((197) assigned 18:19 UTC, not started: E's
      credits). merged_residual_sonnet55 answered 13 sections before
      the weekly limit (129 / 5 / 9 of 143; 91 failed on the limit):
      not measured; re-run after E's fix. Reading: the derived
      statement holds the facts and saves about a sixth of the output;
      it goes into the default only when its eight failures are
      fixed and a clean whole-agreement run shows no more failed
      sections than the plain mode. Ben's three answers still pending
      ((218), (219)): resume the two paused deals on the Sonnet
      default, the qualifier placement, the Opus 5.5 medium remainder.
      The implementers woken: A on (204), E on (197) and the re-run.
      The two deals paused ((175)); no intake ((172)).
      (222) 2026-10-21 23:50 UTC (the manager): the active suite run
      whole in the manager's environment stalled twice today after
      about 420 passing tests, on 381c7592 in tests/product-phase-1.test.js
      ("Preview run boundary starts one detached Sandbox worker") and
      on 07dd0c5a in tests/product-phase-3.test.js ("migration exposes
      only server RPC writes"), with no output for over half an hour
      and the node process gone without the runner's summary; each
      file passes alone (product-phase-3: 31 of 31 in under five
      minutes), and the same heads pass whole in the implementers'
      environments (E: 853 of 854 on 381c7592, 854 of 855 on 07dd0c5a,
      the known failure only). Read as this container's resources
      after two days idle, not the code; the implementers' whole-suite
      results stand as section 9's check for these heads. Merged and
      pushed at 07dd0c5a: E's (198) (the lean normaliser repairs
      components' span ids before the compiler resolves them) and A's
      (204) (introducing words stripped before an Article, Section or
      Agreement reference is read; "Article VI" resolves without
      "this"; a framing phrase such as "For purposes of this
      Agreement" is not a CROSS_REFERENCE and resolves "this
      Agreement" to the root). The levers' re-run of (220)
      (pm-ablation-20261021T213656Z, on 381c7592 without (198)):
      derived_statement_sonnet55 complete, 830 matched, 12 partial, 34
      unmatched of 876, five sections failed on
      proposal.evidence_quotes[].source_span_id (3.2, 8.3, 5.17, 5.19,
      2.5), 5.1 at 50 / 1 / 15 of 66 and the two article
      introductions lost whole (the thin-answer pattern of (196));
      merged_residual_sonnet55 under way. The re-fire with (198)
      follows its end. The two deals paused ((175)); no intake
      ((172)); Ben's three answers pending.
      (221) 2026-10-22 01:40 UTC (the manager): the levers' re-run
      (pm-ablation-20261021T213656Z, on 381c7592 without E's (198),
      21:37 to 01:28 UTC, exit 0, four sections at once) read against
      the plain mode's confirmation ((216): anchors_sonnet55 931 / 20
      / 20 of 971, 2,224,248 output tokens, two sections failed).
      derived_statement_sonnet55: 99 of 104 sections, 830 matched, 12
      partial, 34 unmatched of 876, 846 VALID 15 held, 1,956,587
      output tokens (about 12 per cent fewer per section than the
      plain mode), five failed on proposal.evidence_quotes[].source_span_id
      (3.2, 8.3, 5.17, 5.19, 2.5). merged_residual_sonnet55: 99 of
      104, 851 / 27 / 39 of 917, 903 VALID 26 held, 2,239,064 output
      tokens (the plain mode's; this lever saves the residual calls,
      which the extraction columns do not count), five failed on the
      same shape (8.3, 4.3, 5.5, 5.16, 2.5). Both levers lose the same
      facts beyond the plain mode's: 5.1 at 50 / 1 / 15 of 66 on both
      (the plain mode 63 / 3 / 0: the thin-answer part of (196) and
      (219), now on Sonnet too), III-INTRO 3 and IV-INTRO 2 lost whole,
      3.1 and 3.2 as before. Reading: neither lever is a default yet;
      the shape failures are (198)'s to prove on the re-fire, the 5.1
      and introduction losses are the thin-answer signal E's (196)
      proposed and nothing yet guards, so the plain Sonnet mode of
      (218) stays the default. Re-fired at 01:40 UTC with (198) on
      the sandbox at b5045dde, the same two variants, every section,
      four at once (the job id in the next finding). The two deals
      paused ((175)); no intake ((172)); Ben's three answers pending.
      (223) 2026-10-22 05:40 UTC (the manager): the levers re-fired
      with E's (198) (pm-ablation-20261022T013924Z, the sandbox at
      6c6b7dca, 01:39 to 05:30 UTC, exit 0, four sections at once)
      against the plain mode ((216): 931 / 20 / 20 of 971, 2,224,248
      output tokens, two sections failed) and the run before ((221)).
      derived_statement_sonnet55: 103 of 104 sections, 933 matched, 23
      partial, 41 unmatched of 997, 968 VALID 17 held, 2,136,847
      output tokens, one failed (4.1, MODEL_RESPONSE_SHAPE
      proposal.client_ref, which E's (199a) now repairs; the
      source_span_id failures of (221) are gone). merged_residual_sonnet55:
      103 of 104, 927 / 32 / 33 of 992, 954 VALID 12 held, 2,308,326
      output tokens, one failed (7.3, the same client_ref shape). So
      (198) holds: the shape failures went from five per lever to one,
      and (199a) covers that one. The facts: both levers still lose
      what the plain mode does not, 5.1 at 50 / 1 / 15 and 48 / 3 / 15
      of 66 (the plain mode 63 / 3 / 0), the article introductions
      whole (III-INTRO 3, IV-INTRO 2), 3.7 whole (5) on the derived
      rung, and 3.1 and 3.2 a few more; the thin-answer pattern E's
      (199) guard now fails and retries, built after this job's
      sandbox update. The saving: the derived statement wrote 4 per
      cent fewer output tokens than the plain mode on this run (12 to
      17 per cent on the two before: run-to-run variance in Sonnet's
      thinking swamps it), the merged residual the same output and
      the residual calls' tokens besides, which these columns do not
      count. Reading: neither lever earns the default on the facts
      yet; the guard decides whether 5.1 and the introductions come
      back. Its check fired at 05:40 UTC on the sandbox at 62221f61
      ((199) and (199a)): the eight lossy sections (5.1, III-INTRO,
      IV-INTRO, 3.7, 3.1, 3.2, 8.3, 4.1) on anchors_sonnet55,
      derived_statement_sonnet55 and merged_residual_sonnet55, three
      at once, the job id in the next finding; no more whole-agreement
      lever runs until it reads clean (the weekly budget, (220)). The
      Sonnet default of (218) stands. The two deals paused ((175)); no
      intake ((172)); Ben's three answers pending.
      (224) 2026-10-22 07:05 UTC (the manager): the guard's check
      (pm-ablation-20261022T053736Z, the sandbox at d249a73 with E's
      (199) guard and (199a), the eight lossy sections on the plain
      rung and the two levers, three at once, 05:37 to 06:36 UTC, exit
      0) read row by row. The guard fired on no row: every row carries
      "attempts": 1, including derived_statement III-INTRO (2 facts
      written, both held, 0 of 3 matched), 3.7 (0 of 5) and 5.1 (47 /
      3 / 16 of 66). So the losses it was built for are not thin
      answers: the introductions' facts were written and held (E's
      (199b) reading (b)), and the guard's signal, words left uncited,
      does not see a held-whole answer. The plain rung on the eight:
      III-INTRO 3 of 3, IV-INTRO 2 of 2, 3.7 5 of 5, 5.1 63 / 3 / 0,
      8.3 45 / 1 / 0, 3.2 25 / 0 / 2, 3.1 17 / 3 / 4, 4.1 10 / 2 / 6
      with 9 of 20 facts held: seven CROSS_REFERENCE must resolve,
      Sonnet this time writing the bare numbers "(1), (2), (3), (4) and
      (7)" without the word "clauses", which A's (203) rule required,
      and a LIST with words and no elements (also one on 3.1). The
      merged residual on the eight: 5.1 56 / 3 / 7, 3.1 17 / 3 / 4,
      3.2 24 / 1 / 2, 4.1 11 / 1 / 6 (8 held), 8.3 43 / 1 / 2,
      III-INTRO 0 of 3, IV-INTRO and 3.7 whole. E's (199b): on a
      split section the merged lever's requests are byte-identical to
      the plain rung's, so 5.1's 48 / 3 / 15 twice and 63 / 3 / 0 and
      56 / 3 / 7 on the same bytes is the plain default's own
      run-to-run variance on part 1 (the chapeau's covenants), the
      open stability risk of the Sonnet default. Built on it today:
      A's (205) (the bare clause numbers resolve as the clause form;
      a LIST with words and no elements has its elements cut from its
      words at enumerators, semicolons or commas, else held) and E's
      (199c) (the derived sentence without its second clause;
      part_counts, the opening-words part told its sentence count and
      every part its budget; introduction_counts, an article
      introduction told its qualification count; rung
      counts_sonnet55), merged and pushed with their test files run
      here. Decision: the levers stay parked; one more check on the
      same eight sections with (205) and (199c), the plain rung, the
      two levers and counts_sonnet55, fired at 07:05 UTC (the job id
      in the next finding), decides whether 4.1's holds, the
      introductions and 5.1's part 1 come back; no whole-agreement
      lever run until it reads clean ((220)). The Sonnet default
      stands. The two deals paused ((175)); no intake ((172)); Ben's
      three answers pending.
      (225) 2026-10-22 08:20 UTC (the manager): the second eight-section
      check (pm-ablation-20261022T070212Z, the sandbox at 3915a106 with
      A's (205) and E's (199c), the plain rung, the two levers and
      counts_sonnet55, three at once, 07:02 UTC on, the counts rung's
      last row pending) read against the stored counts and (224).
      Settled: 4.1 is whole on every rung (plain 18 / 0 / 0, derived
      17 / 1 / 0, merged 18 / 0 / 0): A's (205) resolves the bare
      clause numbers. E's (199) guard works: 8.3 carries "attempts": 2
      on the plain, derived and counts rungs and the retry held 46 / 0
      / 0, 44 / 2 / 0 and 45 / 1 / 0. The derived lever with its
      sentence trimmed ((199c)) now matches the plain rung on every
      section but 5.1 (III-INTRO 3 of 3, IV-INTRO 2 of 2, 3.7 5 of 5,
      3.1 20 / 1 / 3, 3.2 25 / 0 / 2, 4.1 17 / 1 / 0). Not settled: 5.1
      part 1, the chapeau's covenants: plain 60 / 2 / 4 this run (63 /
      3 / 0, 48 / 3 / 15, 56 / 3 / 7 before on the same bytes), derived
      49 / 2 / 15, merged 50 / 1 / 15, counts 56 / 3 / 7; the
      part_counts instruction narrows the loss and does not close it,
      and the guard does not fire on it (the part cites its words and
      omits facts). And the article introductions on the plain and
      merged rungs this run: III-INTRO 0 of 3 and IV-INTRO 0 of 2 with
      every fact held on DUPLICATE_FACT_OCCURRENCE. Read by A ((206)):
      not a collision with the sections' copies (the occurrence key
      names no node and the check runs over one answer at a time) but
      the introduction node's own answer written twice: the
      article_introduction_instruction and the a8656b3c per-family
      reminder both ask the introduction node for the qualification
      facts, in two voices, and Sonnet some runs writes each twice on
      the same bytes, which the occurrence rule holds whole. A fixes
      that now (work package 25: one voice on the introduction node);
      the placement question of (218) stays Ben's, with (206)'s
      consequences spelled out. Decision: the levers are parked; the derived
      statement is no worse than the plain rung now but saves nothing
      measurable in output ((223)), and the merged residual's saving is
      the residual calls, to be taken when the unsplit-section path is
      measured on its own. The Sonnet default stands; the open defects
      are 5.1's part 1 (E, work package E11: the split and the
      chapeau) and the introductions' duplicate holds (A, work package
      24: read, no rule change until Ben answers). The two deals
      paused ((175)); no intake ((172)).
      (226) 2026-10-22 10:03 to 10:35 UTC (the manager): the three 5.1
      variance jobs with E11 (pm-ablation-20261022T090218Z, 093531Z and
      100454Z; the sandbox at 7acf9c4f; the plain rung anchors_sonnet55
      and counts_sonnet55, two at once, each over 5.1's 66 stored
      facts), read against the stored facts, the recorded calls and the
      words sent. Rows: plain 48 / 1 / 17, 49 / 2 / 15, 47 / 4 / 15;
      counts 60 / 2 / 4, 60 / 6 / 0, 58 / 8 / 0, the counts rows each
      "attempts": 2 after THIN_ANSWER (BELOW_PART_MINIMUM on part 1:
      "expected_facts": 1, "proposals": 0, "operative_bytes": 32). With
      the six earlier plain readings on the same bytes (63, 48, 48, 56,
      60, 48 of 66) the plain rung spans 48 to 63. Read, not inferred:
      (1) part 1 is the heading. 5.1's chapeau span s4 is "Section 5.1
      Conduct of Business." (32 bytes, one sentence); the four-part
      layout (the heading; (b) 1,772 bytes; (c) 416 bytes; (a) 13,100
      bytes whole) is the stored run's output-cap re-split carried into
      the ablation through splitForAttempt (the stored claim's history
      names the cap failures), on both rungs, so the part-1 call (1,807
      to 1,849 output tokens on every job) reads 300 KB of context to
      write nothing, and E11's count minimum trips on it. The retry
      that follows is the harness's whole-section retry: the second
      attempt re-ran all four calls (293,266 output tokens, twice the
      146,633 recorded; $3.04 at list against the plain rung's $1.24),
      so the counts rung's rows are second rolls of the whole section,
      not a thin part recovered. What the rows do show: the counts
      rung's three rolls (60, 60, 58) each held every lead-paragraph
      fact (unmatched 4, 0, 0) and the plain rung's three (48, 49, 47)
      each lost them (15, 15, 15), the difference between the two
      requests being part_fact_budget and part_count_instruction on
      every part (part 4, limb (a), hears its budget of about 45) and
      the one-sentence chapeau count on part 1; whether the budget line
      alone holds 58 to 60 without the forced second roll is what the
      next three jobs answer once (b) below stops the heading part
      tripping the minimum. (2) The facts
      plain loses are limb (a)'s opening words, not the section's. The
      15 to 17 unmatched are the same each job: the affirmative
      covenants (ordinary course, preserve organisation, assets in good
      repair, officers and consultants, goodwill), the consent standard
      and the exceptions (consent, the Agreement, Law; the Disclosure
      Letter, the Agreement, Law), all stated in the two sentences
      (1,565 bytes) of limb (a) before "(i)", and (b)'s consent standard
      and exceptions in its 425-byte lead. Part 4 is limb (a) whole:
      13,100 bytes, 86,722 to 104,362 output tokens, forty-odd list
      limbs, and Sonnet writes the lead paragraph's covenants in some
      rolls (63, 60) and not others (48). E11 counted the sentences of
      the chapeau span, which for 5.1 is the heading; the opening words
      that carry facts are the limb's. (3) The stored run and the earlier
      readings called this "part 1, the chapeau's covenants" ((199d),
      (225)); the words were limb (a)'s all along. Decision: part_counts
      does not enter the default as built. Work package E12 (E, now):
      (a) the opening-words count moves to the limb: for every limb in a
      part whose text has a lead paragraph before its first numbered
      sub-limb (the bytes before the first "(i)" or "(1)" marker, at or
      over paragraph_min_bytes), the part instruction names that limb
      and its lead's sentence count and asks a proposal for each legal
      effect of each sentence (each affirmative covenant, each consent
      standard, each source of exception, never fewer than the
      sentences), and the part's minimum is the sum of those counts; the
      chapeau_own_part split and the section-chapeau sentence stay for
      a chapeau that states covenants, never for one of fewer than
      paragraph_min_bytes; (b) no part of a heading alone: the re-split
      and longSectionGroups fold a chapeau or paragraph under
      paragraph_min_bytes into the part that follows, and
      thinAnswerSignals applies no minimum to a part under
      min_operative_bytes; (c) a THIN_ANSWER retry re-runs the thin part
      only: confirm the pipeline's attempt-resume replays the healthy
      parts' records on the next attempt (lib/product/attempt-resume.js)
      and give the ablation harness the same, so a retry costs one part;
      (d) behind the part_counts flag still, pinned in
      tests/product-thin-answer.test.js and
      tests/product-fresh-sheet-experiments.test.js on 5.1's real
      layout (the heading chapeau, limb (a)'s two-sentence lead), then
      the three 5.1 jobs again on both rungs. Not changed: the Sonnet
      default; the two deals paused ((175)); no intake ((172)); Ben's
      three answers pending.
      (227) 2026-10-22 11:38 to 12:55 UTC (the manager): E12 merged at
      ebe5dc08 ((199e): the opening-words count on the limb's lead, no
      part of a heading alone, a thin retry of the thin part only; the
      changed test files 33 of 33 here), the sandbox at ebe5dc0, and the
      three 5.1 variance jobs again (pm-ablation-20261022T113757Z,
      115652Z, 121703Z; the plain rung anchors_sonnet55 and
      counts_sonnet55, two at once, 5.1's 66 stored facts). The layout
      on both rungs is now three parts (limb (a) with the heading
      chapeau folded in, 13,132 bytes, part 1; (b) 1,772; (c) 416), no
      heading-only call, no retry on any job ("attempts": 1 on all six
      rows). Rows: plain 63 / 3 / 0, 53 / 6 / 7, 59 / 7 / 0; counts 63 /
      3 / 0, 61 / 5 / 0, 63 / 3 / 0. List prices (the CLI, cache split
      as reported): plain $2.90, $1.58, $1.57; counts $2.85, $1.25,
      $1.46. Against (226)'s six (plain 48 / 1 / 17, 49 / 2 / 15, 47 / 4
      / 15 with the heading part and limb (a) last; counts 60, 60, 58 as
      forced second rolls at twice the cost): the layout fix alone
      lifts the plain rung to 53 to 63 (limb (a) now runs first, with
      the heading), and the count line holds what the plain rung still
      drops once in three (job 5's seven unmatched: the consent
      standards and the exceptions of (a) and (b), the words the limb's
      sentence count names). The partials left on every roll are the
      same two stored facts, the Tax covenant and Parent's extraordinary
      dividends, each written whole where the stored run split them
      (not a count matter; read with the next partial list). Decision:
      part_counts enters the default on both providers
      (lib/product/product-model-config.js, DEFAULT and DEFAULT_CLI,
      pinned in tests/product-default-request-profile.test.js; the
      tests' plain controls now say part_counts: false). Not in the
      default: introduction_counts, untested on an introduction since
      A's (207) (one voice on the introduction node). Runs in flight
      keep their config identity and take the count line on the
      sections still to extract: the same words sent plus one
      instruction sentence per part. Work package E13 (E): (a) a
      default_sonnet55 rung that is REQUEST_PROFILES.DEFAULT as it
      stands, so a default change flows into the ladder without a new
      rung; (b) the eight-section check (III-INTRO, IV-INTRO, 3.1, 3.2,
      3.7, 4.1, 8.3, 5.1) on default_sonnet55 and counts_sonnet55, two
      at once, which decides introduction_counts; (c) read the two
      standing partials (Tax, extraordinary dividends) against the
      stored facts and say whether the stored split or the live whole
      is right, without a rule change. The two deals paused ((175)); no
      intake ((172)); Ben's three answers pending.
      (228) 2026-10-22 14:06 to 14:40 UTC (the manager): the eight-section
      check on the default (pm-ablation-20261022T140617Z; the sandbox at
      3be795f with E's default_sonnet55 rung, REQUEST_PROFILES.DEFAULT
      itself, against counts_sonnet55, the default plus
      introduction_counts; two at once, no retry on any row). Rows,
      default then counts: III-INTRO 3 / 0 / 0 of 3 on both; IV-INTRO
      2 / 0 / 0 of 2 on both; 3.1 22 / 0 / 2 and 21 / 1 / 2 of 24; 3.2
      24 / 1 / 2 and 17 / 8 / 2 of 27; 3.7 5 of 5 on both; 4.1 17 / 1 /
      0 of 18 on both; 8.3 44 / 2 / 0 of 46 on both; 5.1 60 / 2 / 4 and
      51 / 15 / 0 of 66; the rungs 177 / 6 / 8 and 160 / 27 / 4 of 191.
      Decision: introduction_counts stays out of the default. With A's
      (207) the introductions are whole on the default (III-INTRO 3 of
      3, IV-INTRO 2 of 2, the (225) holds gone) and the count sentence
      adds nothing. The default holds the earlier readings elsewhere
      (4.1, 8.3, 3.7 as in (225); 3.1 and 3.2's two unmatched are the
      representation qualifiers whose placement is Ben's open question,
      (218)). 5.1 on the default this roll dropped four of limb (a)'s
      and (b)'s consent-standard and exception facts (60 / 2 / 4) after
      three rolls at none in (227): the limb's sentence count narrows
      the loss and does not close it on every roll; the counts rung's
      51 / 15 / 0 and 3.2's 17 / 8 / 2 are partials, the share-count
      and covenant facts written in a different cut from the stored
      run's, not omissions. Open, no rule change: whether a part's
      answer below its minimum should be retried in the pipeline too
      (the ablation's guard is the pipeline's, (199e); 5.1's four were
      above the minimum, so no guard fires on them) and the shape of
      the facts that come back partial (Ben's, with (c) of E13). The
      two deals paused ((175)); no intake ((172)); Ben's three answers
      pending.
      (229) 2026-10-22 15:30 UTC (the manager): E's (199f) readings
      merged at d9f3d613 and agreed. (b) as (228). (c) Two shapes for
      Ben, no rule change until he answers: a covenant whose object is
      a semicolon list of prohibited actions under one verb and one
      consent standard (5.1's Tax covenant: the stored run one fact
      with five LIST elements, the live rungs five facts each
      repeating the chapeau), and a restriction with a proviso (5.1(b)'s
      extraordinary dividends: the stored run one fact with the
      proviso an EXCEPTION component, the live rungs two facts, the
      proviso unlinked and in the model's words). E's reading on both:
      the stored cut reads the words better; the repeatable fix for
      the first is one sentence in the extractor's instruction, for
      the second the linked-exception rule the schema already states.
      Decision taken: the comparison matcher is fixed now, since the
      ladder's rows are what the tier and lever decisions read.
      Mechanism (E): a stored 5.1 covenant's OWN component bytes are
      mostly the chapeau words the proposal repeats, so a live fact
      that cites the whole chapeau scores MATCHED on a stored fact
      whose limb it never cites (the equity-award covenant matched the
      Tax covenant at share 1 on the default rung), and live facts
      citing fragments score PARTIAL on facts they do state. Work
      package E14 (E): in lib/product/generation-comparison.js (the
      rule compareFacts uses), score a stored fact on its bytes
      outside the section's chapeau span when any remain, and let a
      live fact match one stored fact at most (best share first);
      pinned on 5.1's Tax and equity-award facts; then re-score the
      stored job dirs on the sandbox from their analysis files (the
      six 5.1 jobs of (226) and (227), the eight-section jobs of (225)
      and (228)) with a script under scripts/product, and report the
      rows that change; no extraction change, no new run. The two
      deals paused ((175)); no intake ((172)); Ben's answers pending:
      resume the deals; qualifier placement ((218)); the Opus
      remainder; the two fact shapes above.
      (230) 2026-10-22 16:15 to 16:40 UTC (the manager): E14 merged at
      72e25cf1 (tests 18 of 18 here; the sandbox at 72e25cf) and the
      re-score run over the eight job dirs (scripts/product/re-score-
      ablation.js; the table in the manager's scratchpad). Read: the
      rule as built is not accepted. Its two halves act differently.
      The chapeau exclusion removes the false match of (229). The
      one-live-fact-one-stored-fact rule turns true coverage into
      losses wherever the live run bundles what the stored run split:
      3.7 reads 5 / 0 / 0 of 5 with one valid live fact on every rung
      and every job, and under the new rule 1 / 0 / 4; 5.1's five
      affirmative covenants of limb (a)'s lead (stored as five facts,
      written live as one or two) go MATCHED 1 and 0.99 to UNMATCHED
      0; 3.1 drops three to four, III-INTRO one, on every rung. Rows
      whole, old rule then new: 070212Z plain 5.1 64 / 2 / 0 then 52 /
      2 / 12, counts 62 / 4 / 0 then 53 / 3 / 10; 140617Z default 5.1
      64 / 2 / 0 then 54 / 2 / 10, 3.7 5 of 5 then 1 of 5. What this
      shows, read both ways: the old rule counts a stored fact matched
      when any live fact covers its words, so one bundled live fact
      counts five stored facts matched (3.7: valid 1, matched 5) and
      the ladder's matched counts have hidden bundling; the new rule
      counts the same bundle as four losses. Neither is the reading.
      The script's old-rule column also does not reproduce the
      recorded rows on several jobs (070212Z plain 5.1 recorded 60 / 2
      / 4, re-scored 64 / 2 / 0; 115652Z plain 53 / 6 / 7 against 62 /
      4 / 0): the baseline differs from the live comparison and must
      be explained before any re-scored row is read. Decision: the
      matcher keeps every stored fact's best live cover (no exclusive
      assignment), with the chapeau exclusion where bytes remain, and
      reports bundling beside the match: a stored fact whose
      counterpart is also another stored fact's counterpart is counted
      MATCHED and flagged BUNDLED, with the rung's bundled count in
      the table, so a 5 of 5 on one live fact reads as what it is.
      Work package E15 (E): (a) remove the exclusive assignment and
      add the BUNDLED flag and column; (b) find why the re-score's
      old-rule column differs from the recorded rows (held facts,
      rejected answers, the thin-answer attempt's facts, or a
      different fact set) and make it reproduce them exactly before
      the new column is printed; (c) re-run over the eight job dirs
      and report, per job and rung, matched, bundled, partial,
      unmatched. The (227) and (228) decisions stand until the
      corrected re-score is read: the layout fix and the count line
      were judged on unmatched facts, which bundling does not touch,
      and the chapeau false match is one row. The two deals paused
      ((175)); no intake ((172)); Ben's answers pending as in (229).
      (231) 2026-10-22 16:50 UTC, Ben, on the manager's status and next
      steps, verbatim: "For 2 - shouldn't we let everything land first?
      And shouldn't we just run one?" (resuming the paused deals);
      "On the fact shape - can you be more precise/clear?"; "Same on
      qualifier"; "5 - seems right" (the Opus 5.5 medium remainder).
      Decisions: the Opus 5.5 medium comparison is dropped; its
      partial rows stay in SONNET-CONFIRMATION-NCS-2026-10-19.md as
      evidence and no further section of it runs. The deals resume
      only after E15 lands and the re-scored ladder is read, and one
      deal first (the manager proposes Olaplex 686c3bf2, 38 of 97
      sections, the further along), on the Sonnet default, with its
      unspent retry key; Apogee waits for that run's reading. The two
      fact shapes and the qualifier placement are put to Ben again in
      plain terms (the manager's reply of this time); no rule changes
      until he answers.
      (232) 2026-10-22 17:00 UTC, Ben, on the three shapes put in
      (231), verbatim: "Yep, don't think you even need to say parent
      consent as that is up too in intro no?" (shape 1, the list under
      one verb: option A, one fact with list elements; and the consent
      standard is not restated in it, since the limb's opening words
      state it once); "A on dividend point" (shape 2: the proviso is
      the restriction's exception, one fact); "Option a on placement"
      (the article's qualifiers once, on the introduction; the review
      page shows them above each representation section by code).
      Rules, to be written in code across the corpus (work package 26,
      A): (1) a list of objects under one operative verb inside one
      lettered or numbered limb is one proposal with LIST elements;
      separate limbs stay separate proposals. (2) A proviso that only
      carves out from its covenant is an EXCEPTION component of that
      covenant, not a proposal; a proviso that creates an obligation or
      right of its own is a proposal, linked. (3) The opening words'
      consent standard, time window and sources of exception are the
      opening words' own proposals, stated once; a limb's proposal
      states its own action and cites the governing opening words as
      evidence without restating them. (4) Placement A stands as
      built ((207)); the provisions page shows the article's
      qualification facts above each representation section's table,
      joined by code from the introduction node. The stored Opus run
      repeats the qualifiers per section and splits the Tax covenant's
      list, so against it the new rules read as two unmatched per
      representation section and one bundled Tax fact: expected, not
      losses. Order: work package 26 lands; the eight-section check
      and the 5.1 jobs run once on it; then Olaplex resumes ((231)).
      (233) 2026-10-22 17:35 to 17:50 UTC (the manager): E15 and work
      package 26 merged at 401c0350 (tests 88 of 88 here, both
      branches; the sandbox at 401c035). The re-score run again over
      the eight job dirs: the rebuilt baseline now equals the recorded
      matched / partial / unmatched on every row (eleven rows differ
      only in the "new" count, by one to seven, the live facts no
      stored fact covers; E to say why in (199h), no decision rests on
      it), and the new rule (the chapeau exclusion, no exclusive
      assignment, BUNDLED flagged and counted) leaves every matched /
      partial / unmatched count where the recorded row had it: "rows
      that change: none" on every row. So (227) and (228) hold as
      read. What the re-score adds is the bundling: 5.1 carries 5 to
      45 bundled stored facts of 66 by rung and roll (the default
      34 of 60 matched on 140617Z), 3.7 all 5 (one live fact), 3.1 5
      to 8, 4.1 2 to 3, III-INTRO 2; 8.3 and IV-INTRO none. Read: the
      live Sonnet rung writes one fact where the stored Opus run wrote
      several, most of all on 5.1's lists, which is the shape Ben
      chose in (232) for a list under one verb; the stored baseline
      is the older cut, so bundling against it is expected where a
      list is the reason and a defect where a limb's distinct duties
      were merged. The next baseline (Olaplex's own run and NCS
      re-extracted on the new instruction, when Ben asks) carries the
      new cut. The eight-section check on work package 26's
      instruction is pm-ablation-20261022T173641Z (default_sonnet55,
      loops 2), fired 17:36 UTC; its reading, then the Olaplex resume
      proposal ((231)). The two deals paused; no intake ((172)).
      (234) 2026-10-22 18:05 UTC (the manager): the eight-section check
      on work package 26's instruction (pm-ablation-20261022T173641Z;
      the sandbox at 401c035; default_sonnet55, loops 2; no retry on
      any row), read against (228) and (232). Rows: III-INTRO 3 / 0 /
      0 of 3; IV-INTRO 2 / 0 / 0 of 2; 3.1 19 / 2 / 3 of 24; 3.2 25 /
      0 / 2 of 27; 3.7 5 of 5 (one live fact, 5 bundled); 4.1 17 / 1 /
      0 of 18; 8.3 46 / 0 / 0 of 46; 5.1 64 / 2 / 0 of 66 (21
      bundled); the rung 181 / 5 / 5 of 191, 42 bundled, $10.92 at
      list, the best eight-section reading on any rung ((225) plain
      177 / 6 / 8, (228) default 177 / 6 / 8). The five unmatched:
      four are (232)'s expected rows, the per-section copies of the
      article's two qualifiers on 3.1 and 3.2 (now on the
      introduction alone, 3 of 3 and 2 of 2); one is a loss, 3.1's
      "underlying causes of a missed projection may be a Material
      Adverse Effect" (the MAE proviso on projections), to watch on
      Olaplex, no rule from one roll. 5.1 for the first time loses
      nothing: the lead paragraph's consent standard and exceptions
      held, the Tax covenant is PARTIAL as one bundled fact (the shape
      Ben chose), the proviso of (b) is inside its restriction. 8.3 is
      whole with no retry. Decision: the instruction stands and the
      deals may resume on it. Proposed to Ben now ((231): one deal
      first): Olaplex 686c3bf2 (38 of 97 sections) on the Sonnet
      default with retry key olaplex-apogee-a-retry-2, after the pool
      sandboxes pm-codex-preview-worker and -2 are updated to the
      head; the remaining 59 sections take the new instruction and the
      38 extracted stay as they are (the run's facts are read whole
      on the provisions page; the cut differs on those 38 where a
      list or a proviso is one fact now). Apogee waits for Olaplex's
      reading. No intake ((172)).
      (235) 2026-10-22 18:10 UTC, Ben: "Go" on (234)'s resume. Done
      before the run: the pool sandboxes pm-codex-preview-worker and
      -2 updated to 014ac07 (E's (199h) (c) merged, tests 5 of 5
      here). Found before the retry, and put to Ben instead: the two
      paused runs are pinned to the config they were created under
      (model_config PRODUCT_CLAUDE_CLI_CALL_KIND_MAP/V1: Opus 5, the V9
      profile), and a run advances under its own config
      (claudeCliModelConfigFor, (184)), so a retry with the unspent key
      would finish the remaining sections on the old stack, without
      Sonnet, the split fixes or (232)'s shapes. Correction to (234):
      run 686c3bf2 (38 of 97) is Apogee (CIK 1974640, parties Andor
      LLC, Andor Merger Co., Apogee Therapeutics, Inc.); f1e2493f (34
      of 85) is Olaplex. Put to Ben: A, a fresh intake of Apogee on
      the Sonnet default (the whole agreement on one cut; the old run
      kept as evidence), recommended; B, the retry on the old stack.
      No run woken, no intake, until he answers.
      (236) 2026-10-23 14:40 UTC, Ben: "Draft a handoff document to a new
      agent and make sure human facing checklist etc is up to date." Done:
      docs/codex-program/notes/MANAGER-HANDOFF-2026-10-23.md, a dated note
      (evidence and orientation; the plan stays the one checklist) with
      the state, the open decisions, the loop mechanics, the
      infrastructure without any secret value, the next steps in order
      and the pitfalls. Section 12's manager prompt rewritten for the
      current loop (the 2026-09-04 Sol wording marked superseded);
      section 10 carries a one-paragraph note to the same effect; the
      Phase 5 untouched-agreement item and Q5 carry their 2026-10-23
      status; Phase 6 is untouched and still open. Nothing closed
      without evidence; no run woken; Ben's A or B of (235) still open.
      (237) 2026-10-23 14:36 UTC, Ben, on where a held fact goes when it
      has no home: "I think a section at the bottom of the page (if not
      section understood for the facts) or a at the bottom of the relevant
      section (e.g. termination) for those without a home". Read against the
      provisions page as it stands, by running the page's own builder over
      the run's payload (previewFactsFromWorkspace on the preview read of
      Apogee 88d4032a at 62 of 97): 538 valid facts, 9 held, and HeldFacts
      (components/product/ProvisionTables.jsx, work packages 16 and 17)
      already lists each held fact under its own section with its reason.
      So the section-bottom half of Ben's rule is built; what is missing is
      (a) the page-bottom half: a held fact whose structure node is null, or
      whose section did not load, is in no list and reaches no block; and (b)
      a reason on every held fact: 3.3's two read "held by validation"
      because DUPLICATE_FACT_OCCURRENCE is written on the node, so
      heldReason has no per-proposal issue to read. The nine, with their
      reasons: 3.13 one and 3.17 three ("its quote was not found in the
      source; text missing"), 3.20 two, 3.3 two (no reason), 5.2 one
      ("$1,000,000 individually and $5,000,000": no number could be read
      from its words, one component carrying two tiered amounts; open, no
      rule from one roll). Work package 27 (A, now): attach a node-level
      held issue to each proposal it held; carry a held fact with no section
      to a page-bottom block naming its section where the structure knows it
      and its own words so a lawyer can identify it; extend the preview and
      UI tests; one browser check of the page after it lands. Not changed:
      the extraction instruction; the held rules themselves. Correction to
      the manager's reading of the minute before: the held facts are not
      invisible; two of the nine are unreadable, and one class (no section)
      is unshown.
      (238) 2026-10-23 13:13 to 14:40 UTC (the manager): Ben's A of (235)
      ("1. A") and the Claude subscription ("3. use the claude
      subscription"). Apogee run 88d4032a-d92c-407d-8c2f-9656a85f3916,
      source generation 3, 97 sections, a fresh intake with the new
      idempotency key apogee-fresh-sonnet-cli-1 and provider
      ANTHROPIC_CLAUDE_CLI_SUBSCRIPTION, so a run under
      PRODUCT_CLAUDE_CLI_CALL_KIND_MAP/V3 (Haiku 5.5 routing and residual,
      Sonnet 5.5 extraction at high effort, the DEFAULT_CLI profile). Woken
      on pm-codex-preview-worker at 17:14 UTC; 62 of 97 at 18:36 UTC, no
      failed section, zero marginal cost (the subscription), 1.69M output
      tokens. The identity gate passed without review (Andor LLC, Andor
      Merger Co., Apogee Therapeutics, Inc.; 2026-06-18, original). Olaplex
      queued and not woken, per Ben's "sequential - I agree": run
      ab1cf03b-1acc-489d-b915-7d7a534c9a20, https://www.sec.gov/Archives/
      edgar/data/1868726/000119312526126362/d119132dex21.htm, 87 sections,
      identity CONFIRMED (OLAPLEX HOLDINGS, INC.; HENKEL US OPERATIONS
      CORPORATION; MARGOT ACQUISITION MERGER SUB, INC.; 2026-03-26,
      original) by the pre-intake check on the intake route's own path,
      before any run existed. Correction to (235): run f1e2493f (34 of 85)
      is not Olaplex but Gilead Sciences / Arcellx (EX-2.1 dated
      2026-02-22), 85 sections; its stored identity reads "Inc., Inc.,
      Inc." while the same check of the same URL now confirms Gilead
      Sciences, Ravens Sub and Arcellx, so the parked identity gate is
      fixed in code and that run's stored identity is stale. The held-fact
      repair (six wordless-LIST span resolutions, two duplicate-footprint
      collisions, seen here on 3.13, 3.17, 3.20 and 3.3) is verified on
      branch fix/held-empty-component at 08c17af0, 61 of 61 on the eight
      affected files here, held for merge until the run finalises, so that
      Olaplex is the first deal to run with it. Not changed: no other deal
      woken; no sandbox update while a run holds the worker.
      (239) 2026-10-23 14:52 UTC, Ben, on the monetary cap held at 5.2:
      "I think the word \"in the aggregate\" is missing from this snip. IT
      should show the two facts - the individual and aggregate gaps", then
      "*caps". The observation is right at the component: the settlement
      exception's own words keep both caps ("not more than $1,000,000
      individually and $5,000,000 in the aggregate", twice, at clauses (1)
      and (2) of 5.2(b)(xvi)(C)), but the AMOUNT component the model wrote
      is "$1,000,000 individually and $5,000,000" — it ends before "in the
      aggregate" — so the value parser reads no single number and holds the
      fact ("no parsable value", fact e1c898c0). Decision: an individual cap
      and an aggregate cap are TWO facts, one per cap, each with its own
      amount words and its own qualifier ("individually" / "in the
      aggregate"). Rule to write into the instruction (work package 28, A):
      where one sentence states the same limit individually and in the
      aggregate, propose one fact per cap; never one fact carrying two
      amounts, and never an amount quote that stops short of its own cap's
      qualifier. The corpus is inconsistent on this shape today: the same
      5.2's capital-expenditure cap reads as one fact with THRESHOLD
      $2,500,000 and AMOUNT $250,000, and its new-Material-Contract
      exception carries both amounts inside one EXCEPTION. Not changed
      until the instruction change lands: no rule from one roll and no
      mid-run edit; the held fact stays held, listed under 5.2.
      (240) 2026-10-23 14:40 to 15:00 UTC (the manager): the manager's own
      verification basis on Ben's machine, and the two merged branches. The
      test estate probed file by file, one `node --test` process each,
      without node_modules (an agent's run; the manager read it): 80 files,
      55 fully passing, 19 dying on a missing module (react, react-dom,
      next, @supabase/supabase-js, @anthropic-ai/sdk), 2 needing `node` on
      PATH, none needing a database or the network, 4 hanging (phase-2, from
      the heartbeat drain; phase-3-calibration; phase-4; run-replay, which
      loads phase-2's file). So a lib change can be verified here and a
      component change cannot: every react test is dependency-missing, and
      the passing review tests exercise lib logic only. The widest trusted
      command, run on the merged tree: 126 of 126 over the fact-components
      and agreement-draft lists (fact-components contract, conclusions,
      extraction, store, v8 replay, schema extension, termination-effect
      schema, no-shop period value, proposal identity, fact lines, thin
      answer, lean answer repairs, default request profile). Merged on the
      codex branch: 98f85a07 (the held-fact repair, six wordless-LIST span
      resolutions and two duplicate footprints) and 5935fa52 (work package
      27, every held fact's rule reason and the page-bottom list for a fact
      with no section); the branch head is local only because this machine
      holds no git credential (`could not read Username for
      https://github.com`; no ssh key, no gh, an empty osxkeychain helper),
      so nothing is pushed, the preview deployment has not rebuilt, and a
      sandbox update would clone the old head. The UI half of 27 is
      verified by running the patched builder over the run's real 25MB
      payload (538 valid, 9 held, 0 unplaced, 3.3's two reasons now
      "duplicate fact occurrence") and by a server render of that payload,
      not by a test this machine can run; a browser check waits on the
      first run that produces an unplaced held fact. Put to Ben: a GitHub
      fine-grained token with contents: write on CodeNameHash/
      precedent-machine, or the push from a terminal that has one.
      (241) 2026-10-23 17:14 to 19:20 UTC (the manager): Apogee run
      88d4032a-d92c-407d-8c2f-9656a85f3916 finished. 97 of 97 sections,
      no failed section, 869 proposals of which 858 VALID and 11 held;
      14,117,456 input and 2,220,784 output tokens, zero marginal cost on
      the subscription; about 110 minutes from the wake to the finalised
      draft, in the range (234) projected. The finalisation then failed
      twice before it held. At 19:03 the worker finalised the draft and the
      run reached READY; a DATABASE_ERROR ("upstream request timeout") was
      written against the run immediately afterwards and it fell to FAILED
      though no section had failed. product_phase3_retry_run's
      resume_finalization branch (status FAILED, stage DRAFT_FINALIZATION,
      every section COMPLETE) was spent once with the key
      apogee-finalisation-retry-1; the route answered 500 because it
      assembles the run's full read to build its reply and that read timed
      out, while the retry itself had worked: the run was READY with no
      error at 19:20 and no section was re-extracted. Read as a defect: a
      run that has finalised cannot be allowed to fall to FAILED on a
      write after the draft exists, and a route must not report failure for
      a retry it has already applied. The database was slow while this
      happened and is still slow on big reads: the published read 2.4 s,
      the run status 15 to 25 s, the 38.9 MB preview read 40 s after a 60 s
      timeout on an earlier attempt. Both pool sandboxes were updated to
      4ecc7be (worker-1 from 014ac07) and Olaplex was woken on worker-1 at
      19:15: run ab1cf03b, 87 sections, 3 done at 19:18, so it is the first
      deal extracted with the held-fact repair of (240).
      (242) 2026-10-23 19:25 UTC (the manager): Apogee read. The four live
      documents' bar is a lawyer-reviewable set of facts, so the read is
      the page a lawyer gets: buildTableView over the finalised draft gives
      24 sections, 38 tables, 236 rows, 19 of the rows with no coded cell.
      What is right, first, because it is most of it: the termination
      tables carry mutual consent, the End Date, legal restraint and the
      stockholder vote, the buyer's three rights including the no-shop
      breach with its pre-approval expiry, and the fee table with both
      fees, payer and trigger; 6.1's four conditions, the four no-shop core
      mechanics and the notice limbs, the 33-row Company representations
      table and the 20-row Material Contracts table are populated and read
      correctly on the words. What is wrong:
      (a) the Company's mirror breach termination right (7.1, fact 7.1(e))
      is HELD on "Section 6.1, Section 6.2(a), or Section 6.2(b): a
      cross-reference that resolves to nothing", so the company table shows
      only the Superior Proposal right while the buyer's side shows its
      breach right: an asymmetry a lawyer would read as the deal's balance.
      The same reference form resolves on the buyer's side (Section
      6.3(a)/(b) in the Parent fact), so the resolver's failure is specific,
      not general.
      (b) the two closing-condition sets are merged: "Closing Conditions —
      Buyer" holds rows backed by 6.2 (the Company's conditions) and 6.3
      (Parent's) together — Accuracy of Representations carries five 6.3
      facts beside a 6.2 one, and No Material Adverse Effect is 6.3 alone —
      so the page cannot say which side a condition binds, and the title
      names one side over both.
      (c) 19 valid facts carry no headline summary at all, each with its
      matching HEADLINE_SUMMARY_DROPPED issue (3.3's four capitalisation
      absence facts, three in 5.7's indemnification, two in 3.1, and one
      each in 3.4, 3.6, 3.13, 4.3, 5.11, 6.3, 7.3, 8.4, 8.7), so those
      facts reach the page with no one-line reading. The check drops a
      summary over 18 words rather than shortening it; the correction of
      the manager's first reading (a fact whose summary was "None") is that
      the page has no summary, not a bad one.
      (d) the fee amounts are proposed as their own facts beside the fee
      triggers that already carry them: FEE_TRIGGER and FEE_AMOUNT in 7.3
      quote the same $381,273,716 from the same span, and the Termination
      Fee's amount likewise; the table renders one row per fee, so the
      duplication is in the evidence list and the count, not in the table.
      No rule from one deal: recorded, not changed.
      (e) 119 CONCLUSIONS_MISSING and 134 CONCLUSIONS_CELLS_DROPPED issues:
      about 14 per cent of the facts carry no readout, so they are evidence
      under their section and never a row. Also open: 11 held facts, of
      which 8 are the classes the merged repair fixes (two duplicate
      footprints at 3.3, six wordless lists at 3.13, 3.17 and 3.20) and
      therefore only on a fresh extraction, and 3 are decisions: 5.2's
      individual-and-aggregate caps ((239), instruction change pending);
      5.3's "value multiple period literals" (one period component holding
      more than one period, open); and (a)'s cross-reference.
      Work packages from this read: 28 the caps (already (239)); 29 a
      cross-reference to a limb ("Section 6.2(a)") resolving to its section
      or its limb node, so a whole fact is never lost to one reference;
      30 closing conditions split by side, which is Ben's page-shape
      decision and is put to him; 31 the empty-or-"None" headline summary
      on a valid fact. Nothing else in the read is proposed for change: the
      fact shapes Ben chose in (232) hold on the words (a six-item access
      list is one fact; the dividend and MAE provisos sit inside their
      covenants as EXCEPTION components).
      (243) 2026-10-23 19:40 UTC, Ben, on (242)(b): "two tables - what are
      the other conditions?", then "ok" to the shape put to him. Decision:
      the closing conditions are two tables, "Conditions to the Company's
      Obligations" (the facts whose opening words are "The obligation of
      the Company ... waiver by the Company", 6.2 here) and "Conditions to
      Parent's Obligations" (the facts whose words are "... or waiver by
      Parent", 6.3 here), the side read from the fact's own words and never
      from a section number. The "Other conditions" row is a catch-all and
      holds one fact today, from 5.9, which is the negative "Making any such
      filing, giving any such notice or obtaining any such Consent is not a
      condition precedent to any of Parent's or Merger Sub's obligations to
      consummate the Closing": it goes in the Parent table as its own row,
      "Filing, notice or consent - expressly not a condition precedent",
      because a negative hidden under a catch-all is how a reader misses
      it. Work package 30 (A, now): the two sections and their titles in
      the table shapes with the side rule and its tests on 6.2's and 6.3's
      real words, the negative row, one browser check of the page. Not
      changed: the extraction instruction and the fact model; the facts
      already name the side.
      (244) 2026-10-23 19:40 to 20:55 UTC (the manager): three work
      packages landed and the DeepSeek tier was measured. Work package 30
      (the closing conditions split by the side in the facts' own words)
      merged at d6c4125a; on the Apogee payload the two tables read
      Parent's (4 rows, all 6.3, plus the 5.9 filing negative) and the
      Company's (3 rows, all 6.2) with the mutual table unchanged, 58+86+46
      tests green. Work package 31 (the DeepSeek provider) merged at
      2a361963: provider DEEPSEEK_API, base URL
      https://api.deepseek.com/anthropic (an Anthropic Messages endpoint,
      verified live), ROUTING and RESIDUAL on deepseek-flash at effort low,
      EXTRACTION on deepseek-v4-pro at effort high, key DEEPSEEK_API_KEY
      plumbed through the wake, prices from the published table with peak
      and off-peak. Work package 32 (the lawyer preview read) merged at
      ce1def4b then c31c9a7f: Ben, "the preview page opened very slowly";
      the read now projects to what the page renders, 45.7 MB and 45 to 59
      s before, 3.9 MB and 16 s after on the live deployment, with the
      rendered HTML byte-identical (sha256 1ef72de0…) and a size guard in
      the tests; a finished run's read is now reusable for a minute
      (dd44090b). The remaining 16 s is the database scanning a 97-section
      run's rows, not the bytes: 31 sections take 8 s and a light query
      0.7 s. Two parser defects were found by the DeepSeek run and fixed:
      the response contract offers residual dispositions and coverage
      states as JSON lists meaning one of them, and DeepSeek returns a
      one-element list, which failed as "RESIDUAL_DISPOSITION:
      KNOWN_FAMILY" and "COVERAGE_STATE: 1.6:MERGER_STRUCTURE_CLOSING" with
      the value plainly allowed; both now read a one-element list as its
      element and still refuse two (1e950348, d8b6bab7).
      (245) 2026-10-23 20:05 to 20:55 UTC (the manager): the DeepSeek
      comparison, run 34847358 (generation 4, 97 sections, provider
      DEEPSEEK_API). All 97 sections extracted, no failed section, 22,441,073
      input and 3,862,542 output tokens, $18.02 at DeepSeek's own prices, in
      about 45 minutes. Against the Claude run of the same agreement on the
      same instruction (88d4032a): Claude proposes 869 facts, 858 VALID and
      11 held (1.3 per cent); DeepSeek proposes 874, 758 VALID and 116 held
      (13.3 per cent). The held reasons are the classes the validator
      already names for Claude, only far more frequent: text missing, no
      supporting span, quote not found in the source, duplicate fact
      occurrence, a relationship not allowed. Read: DeepSeek proposes a
      comparable number of facts and its citation discipline is an order of
      magnitude weaker, and citation discipline is this product's guarantee
      — a held fact is invisible to the lawyer. Cost is real but not
      decisive at 97 sections: $18 against roughly $35 to $50 at Anthropic
      list for the same volume (the Claude run cost $0 marginal on the
      subscription), and DeepSeek pays full input price because its cache
      does not behave as Anthropic's (22.4M input tokens here against 14.1M
      on Claude for the same agreement). Recommendation to Ben: do not
      switch the default on this evidence; the tier is worth another trial
      only with the quoting instruction hardened first (quote only an exact
      substring of a listed span, never a paraphrase), and the flash tier is
      not yet tested end to end at all. The loss is not evenly spread: 41 of
      92 sections produced fewer valid facts, the largest 5.3 the no-shop
      (54 to 42), 5.5 antitrust (33 to 24), 3.13 material contracts (40 to
      32), 7.3 fees (20 to 13), 5.9 (12 to 7); and 5.16, the regulator
      cooperation and notice covenants, produced NOTHING at all against
      Claude's six — not a validation loss but an empty answer the thin-answer
      guard did not catch on a 2.8 KB section. Several DeepSeek facts also
      arrive with no headline summary (5.1's eight all empty).
      Also found here, and not a DeepSeek matter: draft finalisation fails
      intermittently on the preview database — 88d4032a reached READY then
      fell to FAILED on a write after the draft existed and needed one
      retry, and 34847358 failed three times ("canceling statement due to
      statement timeout") before a later attempt succeeded with every
      section committed. So it is load-dependent timing, not a broken
      finalise: the same deal finalises on a retry. Still a defect — a run
      that has finalised must not be able to fall to FAILED, and a
      finalisation that needs three retries will strand a lawyer waiting —
      but it is a retry-and-batch problem, not a redesign, and it does not
      block the read: the preview returns every committed section whether or
      not the draft finalised.
      (246) 2026-10-24 23:00 UTC (the manager), work package 33: the
      silent absence is answered on the lawyer preview page. Ben's bar,
      from the new-chat prompt of (2026-10-24): "a section that returns no
      facts must never read as 'this agreement has no such provision'".
      What the two runs of Apogee show: DeepSeek 34847358 produced no fact
      at 5.16 (Regulatory Matters, 3,413 bytes, six facts on Claude's
      88d4032a) and none at 3.30 (No Other Representation, which Claude's
      run does extract); Claude's own run leaves no main-agreement section
      without a fact, but the page had no block for one either, so the hole
      was provider-independent. In every case the draft already carries the
      absence claim as something the review must decide (an
      IMMATERIAL_ROUTING item for a section the router read as immaterial,
      a COVERAGE item for a family the extraction answered NOT_FOUND, and
      the review's own "AI identified this subject but proposed no facts"
      warning on an UNRESOLVED routed family, tests/product-empty-
      extraction-ui.test.js), but the preview page a lawyer reads showed
      nothing at all, so the silence read as an absence. The page now
      names, under the title and in the quiet drift/out-of-scope style,
      every substantive section that produced no fact at all, in section
      order, with its authored heading and its reason (read as immaterial,
      routed families that returned nothing, or words flagged as
      unclassified; a payload that carries no routing at all says the
      stored analysis does not say which families the section was read for)
      and one sentence: "This is not a finding that the agreement has no
      such provision." Exhibits and annexes, a section
      inside one, and an out-of-scope exhibit already named by its own
      line are not listed; a section with a valid, held or rejected fact
      is not listed either (a held fact is listed with its reason, a
      rejected one is the lawyer's decision). Read over the stored
      payloads: DeepSeek 34847358 lists 3.30 No Other Representation and
      5.16 Regulatory Matters, Claude 88d4032a lists none, and the five
      empty sections of the Claude run (Exhibits B and D and the
      disclosure schedule's 3.6, 3.24, 3.27) stay out. The preview read
      now carries each routing's families and its known disposition, and
      never the router's rationale (the projection's size guard stays at
      32 KB). Files: lib/product/provisions-preview.js
      (sectionsWithoutFacts), lib/product/preview-handler.js
      (projectRouting), pages/review/product/[id]/provisions.js
      (SectionsWithoutFacts). Tests: tests/product-provisions-preview.test.js
      (the list and its reasons on the agreement's own words, the render,
      no lines when every section has a fact) and
      tests/product-preview-handler.test.js (the routing projection).
      Nothing else changes: no coverage state, no review item, no
      extraction instruction; the browser check of the changed page waits
      on the deployment rebuild.
      (247) 2026-10-24 23:10 UTC (the manager), work package 34: a
      cross-reference that names several provisions resolves, and the
      Company's mirror breach termination right is no longer lost to it.
      Apogee 88d4032a held 7.1(e) on "Section 6.1, Section 6.2(a), or
      Section 6.2(b): CROSS_REFERENCE must resolve" (draft issue against
      client_ref part2:p_e, component 3.1), so the termination table showed
      the Superior Proposal right alone while the buyer's side showed its
      breach right. The buyer's fact was VALID only because its reference
      sits inside its CONDITION's own words and never became a component;
      the resolver's single forms ("Section 6.2(a)", "this Section 7.1(e)",
      "Article VI", "this Agreement") were never the problem — a reference
      naming more than one provision had no form at all. That narrows the
      plan's work package 29 (put as "a cross-reference to a limb resolving
      to its section or its limb node"): the limb form already resolves.
      The resolver now reads a reference as its parts — "Section 6.1,
      Section 6.2(a), or Section 6.2(b)", "Section 6.3(a), Section 6.3(b)
      and Section 6.3(c)", "Section 6.1(b) or Section 6.1(c)", "Sections
      3.3(b), (c) and (e)", "Section 6.2(a) or (b)", a section with its
      title in parentheses between the parts, and Article with Section — and
      points resolves_to at the nearest node every named part is under (the
      article that holds them, the agreement when they span articles), with
      each named provision's heading in the resolves_to text the sidebar
      shows. One part the agreement lacks leaves the whole reference
      unresolved, as "Section 9.9" was. On the Apogee words 7.1(e)'s
      condition resolves to ARTICLE VI with 6.1's and 6.2's headings, and
      its own terminator-breach bar (6.1, 6.3(a), 6.3(b)) the same way, so
      the fact compiles VALID with the rest of the tree unchanged. Files:
      lib/product/agreement-draft.js (referenceListParts,
      singleReferenceNode, nearestCommonNode, structureReferenceTarget).
      Test: tests/product-fact-components-extraction.test.js — the
      agreement's own 6.1, 6.2, 6.3 and 7.1(e) words through
      compileExtraction, the resolved node and text, the other forms, and
      the unresolved part; 33 of 33 in that file. Nothing else is
      re-extracted: a stored held fact stays held and the next run of a
      deal carries the fix.
      (248) 2026-10-24 23:50 UTC (the manager), work package 35: the 19
      facts without a headline summary on Apogee 88d4032a keep their line.
      The plan's (242)(c) read them as one class, "a summary over 18 words
      is dropped rather than shortened"; the 19 HEADLINE_SUMMARY_DROPPED
      issues of the stored draft have four causes: 8 over the checker's
      18-word cap (19, 19, 19, 19, 19, 20, 21 and 24 words), 9 naming one
      of the agreement's own sections inside a real sentence (5.7's four,
      3.3's four, 7.3's one), 1 a statutory citation refused by a check
      that the rule it enforces does not support ("Parties acknowledge 6
      Del. C. § 2708 is satisfied and mandates Delaware Law": the rule
      text says a statutory section may be named, and the check refused
      any "§"), and 1 a trailing full stop. Changed, in
      lib/product/fact-components.js: the cap is 24 words, the point at
      which a line stops being one line rather than the point at which it
      slightly missed the 15 the extractor is asked for (16 to 24 words
      are one line at the page's 9.5px; the eight over-length lines are
      all 19 to 24); a line over the cap, or one ending with a period, is
      shortened by repairHeadlineSummary — at the last clause boundary at
      or before the cap, a dangling connective removed, the words kept —
      and the original and the line are reported as a
      HEADLINE_SUMMARY_SHORTENED note instead of the drop; the section
      check refuses only a summary that is nothing but a locator (fewer
      than four words of substance once the references are out), because
      "Section 5.7 provisions survive consummation of the Transactions" is
      a line a lawyer reads and a blank line is worse (Ben's "it needs to
      be a summary of the provision on the right etc - like in the normal
      course. Not just a sec ref...!" is about a summary that IS a sec
      ref); a "§" is a statute's citation and is content. Read over the
      stored 19: 18 keep their line as written, 1 (the trailing period) is
      repaired, none is dropped. Not changed: a summary that quotes the
      agreement, carries a foreign-script character or is only a locator is
      still dropped with its problems (a cut cannot repair those), and a
      summary the model left out altogether is still the review's
      HEADLINE_SUMMARY_MISSING note — DeepSeek's 5.1 arrived with eight
      empty summaries, a provider behaviour on the tier that is not the
      default (245), not a formatting slip the code should invent words
      for. Tests: tests/product-fact-components-contract.test.js (the cap,
      the locator rule, the statute, the shortening and what it refuses)
      and tests/product-fact-components-extraction.test.js (the note on a
      fact that stays VALID, the trailing period, the locator in a
      sentence kept and a locator alone dropped).
      (249) 2026-10-24 23:59 UTC (the manager), work package 36: the
      individual-and-aggregate caps rule Ben decided in (239) is in the
      extractor instruction, so the contract is
      PRODUCT_ALL_FAMILY_EXTRACTOR/V11. His words: "I think the word \"in
      the aggregate\" is missing from this snip. IT should show the two
      facts - the individual and aggregate gaps", then "*caps". The rule,
      added after the proviso sentence in the six fact-shape rules of
      (232): "Where one sentence states the same limit both individually
      and in the aggregate (\"not more than $1,000,000 individually and
      $5,000,000 in the aggregate\"), propose one proposal per cap, each
      quoting its own amount words with its own qualifier
      (\"individually\", \"in the aggregate\"); never one proposal carrying
      two amounts, and never amount words that stop short of their own
      cap's qualifier." What it answers: 5.2's settlement exception
      states "not more than $1,000,000 individually and $5,000,000 in the
      aggregate" twice (clauses (1) and (2) of 5.2(b)(xvi)(C)), the model
      wrote one AMOUNT ending before "in the aggregate", the value parser
      read no single number and the fact was held (e1c898c0). Not
      changed by this: the stored held fact stays held and no mid-run
      re-extraction happens; the next run of a deal carries the rule. The
      version bump's cost is recorded rather than hidden: a stored V10
      call no longer matches a request rebuilt from this code, so run
      replay reports the drift and attempt resume re-runs an interrupted
      section (Olaplex ab1cf03b, paused at 27 of 87, would re-extract the
      section it was released on; its 27 completed sections are stored and
      are not re-extracted). Files: lib/product/agreement-draft.js
      (the instruction text and LEAN_PROMPT_VERSION). Tests:
      tests/product-thin-answer.test.js (the instruction states the rule
      and the version is V11) and the prompt-version strings of
      tests/product-ablation-wake.test.js,
      tests/product-lean-request-profile.test.js and
      tests/product-deepseek-api-provider.test.js.
      (250) 2026-10-25 00:20 UTC (the manager), work package 37: the draft
      finalisation retries itself and an applied retry is never reported as
      a failure. The evidence is (241) and (245): 88d4032a finalised, a
      DATABASE_ERROR ("upstream request timeout") was written against the
      run immediately afterwards, the run read FAILED with no failed
      section, and the retry route answered 500 for a retry it had already
      applied because it assembles the run's full read to build its reply
      while the retry itself had worked; 34847358 failed three times
      ("canceling statement due to statement timeout") before a later
      attempt held. Two changes, neither a redesign (the plan's reading:
      "a retry-and-batch problem"). (a) lib/product/analysis-runner.js:
      finalizeCompletedAnalysis runs its load, assembly, validation and
      write through finalizeWithRetries — three attempts, 2 and then 4
      seconds apart, each logged as FINALIZATION_RETRY — and only a
      failure that survives them reaches failRun. Retried are the
      transient shapes the two runs recorded and their class (timeouts,
      "canceling statement", connection resets and refusals, socket hang
      up, fetch failed, 502/503/504); not retried are the deterministic
      refusals (identity, component, totals and hash mismatches, a section
      incomplete, an invalid finalization). The retry is safe because the
      database finalise is already idempotent: product_phase2_finalize_
      saved_run returns the stored draft on a second call with the same
      draft_analysis_id and payload hash, so a retry after a client-side
      timeout that committed writes nothing. Not changed: the database
      function, the batched-write question (a finalise of a 97-section run
      is one transaction; making it resumable in the database is the
      larger cure the plan leaves open) and the route's success body.
      (b) lib/product/run-handler.js: a request that has applied an
      operator retry records that it did, and a failure after it —
      including the heavy analysis read that builds the reply — answers
      202 with retry_applied, the run's status and stage from a single-row
      read and warning RETRY_APPLIED_READ_INCOMPLETE, instead of 500.
      Tests: tests/product-finalization-retry.test.js (the retry rule on
      the three recorded messages and the deterministic refusals; two
      timeouts then a write that holds; attempts spent; the applied retry
      answered 202 when the read after it throws; an ordinary route
      failure still 500). The database-shaped suites
      (product-failed-model-call-durability, the -db files) cannot run on
      this machine (TEST_DATABASE_URL or TEST_PGLITE_MODULE is required);
      the route and runner suites that can (product-hosted-worker-pool 14,
      product-attempt-resume 7, product-phase-3 26 with its one
      pre-existing source-regex failure) are green.
      (251) 2026-10-25 00:45 UTC (the manager), work package 38: the
      lawyer preview read is served from a stored read model, Ben's choice
      of the two cures section 0 put to him ("Build the server-side read
      model", 2026-10-25). The problem, as measured: the page's payload is
      3.9 MB after work package 32 but the read is about 16 s on a
      finished 97-section run, nearly all of it the database scanning the
      run's rows (finding (244): 31 sections 8 s, a light query 0.7 s;
      finding (241): 40 s on the 38.9 MB read before that), and every
      view rebuilt the same projection from product_section_results,
      product_source_closures, product_source_spans,
      product_section_routings, product_proposals, product_issues,
      product_fact_components, product_fact_headlines and
      product_fact_conclusions (loadPreviewSectionResults, 9 tables paged
      500 rows at a time). Built: supabase/migrations/
      20261025000000_product_preview_read_model.sql —
      public.product_preview_reads(run_id primary key, payload jsonb,
      built_at, stale boolean), RLS on, service role only, no grant to
      anon or authenticated (the row is exactly the payload the route
      already returns after its own access check); the delivery rule in
      lib/product/preview-read-model.js/previewModelUsable (only a READY
      or FAILED run, only a non-stale row, only the payload version this
      code builds); the store methods in
      lib/product/phase-2-store.js (getPreviewReadModel,
      savePreviewReadModel, markPreviewReadModelStale); the handler
      (lib/product/preview-handler.js) reads the run row first, serves the
      stored model on a hit without reading the analysis at all, stores
      the projection on a miss, and answers X-Preview-Read MODEL or
      REBUILT; every review save marks the run stale
      (lib/product/phase-3-store.js saveReview), and a finalisation marks
      it stale too, so a retry of a FAILED run that re-finalises with
      different facts is rebuilt on the next view. A run still analysing
      reads live and stores nothing; a store without the model (an older
      deployment) or a table the migration has not reached (42P01 /
      PGRST205) falls back to the live read with the error on the
      deployment log, so the code is safe to deploy before the migration
      lands. Not changed: the live path's own projection, the browser's
      one-minute private cache, the review read and the analysis read.
      Tests: tests/product-preview-read-model.test.js (the rule; stored
      once then served without a section read; a review save rebuilds
      once; a live run never uses it; a missing table and a store without
      the methods both answer live) and tests/product-preview-handler.test.js
      (12) stay green; product-phase-3 is 26 with its one pre-existing
      source-regex failure. Open on this work: the migration has not been
      applied by this session (no database credentials here and no local
      Postgres or PGlite: every -db test needs TEST_DATABASE_URL or
      TEST_PGLITE_MODULE), so the row's own effect is proven by the same
      migration harness in CI and the live preview read is unmeasured
      until the deployment has both the build and the migration.
      (252) 2026-10-25 01:00 UTC (the manager): the 5.3 held fact of
      (242)(e), read. (242) recorded it as "5.3's 'value multiple period
      literals' (one period component holding more than one period)"
      and left it open. The stored draft says otherwise. The held fact is
      the subsequent-matching-period right (proposal a8e28bac, fact type
      SUBSEQUENT_MATCH_PERIOD, INVALID on INVALID_FACT_COMPONENTS at
      component 3). Its PERIOD component is the model's own "three (3)
      business day" and parsed to 3 BUSINESS_DAY; what held the fact is a
      LIST component the model wrote with no words at all (quote "",
      no bytes) whose two LIST_ELEMENT children did resolve — and did
      not resolve in order: the first element's words start at byte
      172087 and end at 176387, the second's at 176107 and end at 176530,
      so the first contains the second. Work package 25's repair takes a
      wordless LIST's words from its first element to its last only when
      every element resolved in order (fact-components.js
      LIST_WORDS_FROM_ELEMENTS), so this one stayed wordless and the
      empty component held the whole fact. The VALUE_MULTIPLE_PERIOD_
      LITERALS issue on the same proposal is a note from the legacy
      no-shop period parser (lib/product/no-shop-period-value.js, raised
      only for hour-denominated periods) and is not what held it. Not
      changed: promoting a wordless LIST's elements to siblings would
      keep every word but changes the fact's shape (a Ben decision, and
      "no rule from one deal"); the words show the model mis-anchored the
      first element to an earlier occurrence of a repeated phrase, which
      is the class the held-fact repair of (240) took on and this shape
      did not reach.
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
      (141) 2026-10-18 21:14 to 22:20 UTC (implementer D), work package D2
      on the manager's message of 21:10 UTC: every database test of the
      CI "Database migration and rollback" step on the full migration
      list, the push trigger, and the results before and after. No run
      touched. Environment: this container has Postgres 16 installed
      (/usr/lib/postgresql/16, cluster "main" on 127.0.0.1:5432, started
      with pg_ctlcluster; TEST_DATABASE_URL=postgres://postgres:...@
      127.0.0.1:5432/postgres), so the step ran here against a server,
      one file at a time in the CI order, each file alone, before and
      after the change; not the embedded Postgres of finding (104), the
      same inactive database in the same transaction-and-rollback form.
      Built: tests/helpers/product-database.js is the one harness
      (setupDatabase applies every file of supabase/migrations in name
      order, 42 today, in one transaction; teardownDatabase rolls back
      and asserts the first, a Phase 2 and a Phase 3 table are gone;
      databaseFacade is the Supabase-shaped client; a test that proves
      one migration's own effect names it in `hooks` with `before` and
      `after` callbacks on that file, so a measurement or a savepoint
      sits exactly where the test's prefix used to end, and a ROLLBACK
      TO that savepoint undoes the migration and every later one, which
      keeps the absence assertions true on the full list). Every file of
      the step now sets up through it: product-phase-2-db re-exports it
      for the fourteen tests that require it; phase-1, phase-6 and
      failed-model-call-durability use it directly. Removed with that:
      phase-1's three-file prefix (its third file, 20260905200000,
      calls product_private.product_phase2_commit_section, so on a fresh
      database the test failed in setup, "function does not exist",
      before anything else); phase-2's list of eleven and its second
      application of 20260905201000; phase-3's seven manual applies;
      the prerequisite lists of nine tests; the per-test
      PRODUCT_*_SKIP_MIGRATION switches, set nowhere in the repository
      or the workflow. The in-test re-application review-timing makes
      (restore the pre-V3 save function, then re-apply the reference
      samples V3 migration) stays, through the harness's applyMigration.
      Harness defects the full list exposed, fixed in the harness or the
      test, never in a migration: (a) node-postgres sends a JavaScript
      array as a Postgres array literal, which a jsonb parameter refuses
      ("invalid input syntax for type json"); the three facades and
      identity-lookup's insertJsonRows passed arrays straight (a section
      failure's model calls, 816 proposal rows), written against PGlite
      where that passes; the one facade now sends an object, and any
      array that is not all strings (an empty one included), as JSON
      text, and leaves a text[] (the sandbox pool) alone; (b) count(*)
      and sum() read back as text from node-postgres, numbers on PGlite:
      monotonic-failure reads them as numbers. Rules a later migration
      changed, the expectation updated on the migration's own words: (c)
      20260907005021_product_article_intro_coverage removes the "-INTRO"
      exclusion from the work set and raises "product article-
      introduction exclusion remains" if it is still there (its own
      check; the file carries no comment line, which is worth one): the
      phase-1 fixture's work set is three nodes (1.01, Exhibit-A::1.01,
      the article introduction), the exhibit container still excluded;
      the test completes the third section before the run is READY and
      counts three COMPLETE rows; its mid-test re-application of
      20260905190000, written to prove that migration prunes rows it
      had inserted by hand, is gone (an out-of-order re-application on
      the full list would have re-installed the exclusion); (d)
      20260905221000_product_analysis_running_progress puts `running`
      in every progress object: failed-model-call's final progress reads
      running 0, and the test of that migration itself writes its
      fixture and reads its baseline in a hook just before the file
      (the baseline has no `running`, the read after it has). (e) The
      span-closure test's proof is measured the same way: the indexes
      and the database surface just before and just after
      20260905223000 (the reverse index is the only thing added, the
      surface unchanged), then in the test body the read is identical
      with the index dropped under a savepoint and again once it is
      back. (f) identity-lookup, termination-effect, cross-section and
      the sandbox pool test place their savepoint and pre-state in the
      hook before their file; identity-lookup's rollback proof runs at
      teardown instead of before the test. Current code the old prefix
      never reached (phase-3 failed at the first recorded model call,
      failed-model-call at the first section failure), the fixture made
      true to the current extractor, no migration rule involved: (g)
      phase-3's acceptAll is phase-6's (a held proposal rejected, a
      relationship the review state refuses rejected: REVIEW_INVALID_
      PROPOSAL, REVIEW_RELATIONSHIP_SOURCE on the synthetic draft), its
      release evaluation carries the REVIEWED_OMISSION resolutions of
      the UNRESOLVED coverage as phase-6's does (RELEASE_EVALUATION_
      REQUIRED otherwise), the proposal it groups and the proposal it
      edits are VALID ones (REVIEW_INVALID_PROPOSAL_SOURCE otherwise),
      and its first test asserts the evaluation passed with the bars in
      the message; (h) failed-model-call's counts are read from the
      first attempt (a long section is extracted in parts since Q6, so
      one attempt is seven calls on this section, not three): the
      section's totals equal the attempt's recorded calls, the replay
      keeps them, the second attempt doubles the rows and each first
      extraction has one twin with the same request and response under
      another call id, the retried section carries three attempts'
      calls. CI: `on.push.branches` now lists main, codex/product-
      implementation-plan-20260904 and claude/festive-albattani-70cwn5;
      nothing else in the workflow changed, and the database step runs
      the same eighteen files. Results, each file alone in the CI order
      (tests, pass, fail): before, on the tip before this work:
      phase-1 1/0/1 ("product_private.product_phase2_commit_section
      does not exist" in setup); phase-2 2/0/2 and phase-3 3/0/3
      ("invalid product model invocation identity", finding (104));
      failed-model-call-durability 1/0/1 (transaction aborted after the
      json error); provider-response-durability 2/0/2 (the same);
      monotonic-failure 5/0/5 ("invalid input syntax for type json");
      analysis-running-progress 1/1/0; review-timing-integration 1/1/0;
      finding-resolution 2/2/0; relationship-review 6/5/1 (one json
      error); span-closure-lookup 1/1/0; cross-section-relationship
      2/2/0; legal-schema-revision-persistence 2/0/2 ("relation
      product_fact_components does not exist": its prefix stopped before
      the V2 migration the store now reads); fact-occurrence-collision
      3/3/0; termination-effect 2/2/0; review-validation-identity-lookup
      2/0/2 (json error); sandbox-pool 4/4/0; phase-6 1/1/0 (156 s).
      After: all eighteen files pass, 40 tests of 40: phase-1 1/1/0; phase-2 2/2/0 (147 s); phase-3 3/3/0 (280 s); failed-model-call-durability 1/1/0 (134 s); provider-response-durability 2/2/0; monotonic-failure 5/5/0; analysis-running-progress 1/1/0; review-timing-integration 1/1/0; finding-resolution 2/2/0; relationship-review 6/6/0; span-closure-lookup 1/1/0; cross-section-relationship 2/2/0; legal-schema-revision-persistence 2/2/0; fact-occurrence-collision 3/3/0; termination-effect 2/2/0; review-validation-identity-lookup 2/2/0; sandbox-pool 4/4/0; phase-6 1/1/0 (152 s); about 15 minutes in all, the four runner-driven files most of it. The nineteenth file the merge of origin added to the step, tests/product-move-to-production.test.js (implementer B), applies the full list through lib/product/production-move.js by design and passes here too, 1/1/0. On the merged tree npm run test:active: 780 tests, 779 pass, the one failure the known Codex-client final-message test. Defects in a migration: none found; the one gap is 20260907005021's missing comment line, noted under (c). npm run test:active after the change:
      768 tests, 767 pass, the one failure the known Codex-client final-message test. One commit for the harness, the tests, the workflow,
      the guide line and this finding.

      (142) 2026-10-18 22:58 to 2026-10-19 01:05 UTC (implementer D), work
      package D3 on the manager's message of 22:55 UTC: an attempt resumes
      after a worker stop. No run woken or touched; the two sandboxes not
      updated; NCS generation 5 read by SQL on the preview branch only.
      Evidence first. 5.8's work row has attempts 2 and an empty
      error_history: the restart's lease expiry was written as `error`
      alone by product_phase1_recover_expired_sections and the next claim
      cleared it, so nothing on the row says two parts were done ($2.69
      of calls, 18:07 to 18:19 UTC) before the worker died. A second gap
      found on the way: work package 15's part reached `failRun` but not
      `failSection` (phase-1-store wrote the message alone, phase-2-store
      the message alone), so no section's history ever named the part a
      failure fell on and the re-split by part of findings (84) and (88)
      never fired on the hosted path; 5.1's four-part attempt 4 came from
      (84)'s halving of the group bytes. Both fixed here. Built: (1)
      lib/product/attempt-resume.js. A call's identity is its kind, prompt
      version and canonical logical request, read alike from the request
      object, the CLI string and the API's two text blocks (`logicalRequest`,
      `callIdentity`); the part identities of migration 20260914125500 and
      the content-block reader of 20261018143000 stay the invocation
      identities, so a reused call is admitted under the new attempt's
      "<token>:part-<n>" from the part its own request carries. A later
      attempt may reuse a call of an earlier attempt when the history
      records that attempt, with its token, as interrupted
      (WORKER_STOPPED, WORKER_RESTART, SECTION_LEASE_EXPIRED: every call it
      completed) or as failed on an extraction part (routing, residual and
      the parts before it); any other failure (a JSON answer, a residual
      consistency refusal) frees nothing, since the calls themselves may
      be the cause; a re-split section's parts are other calls and reuse
      nothing. The runner hands every attempt a `resumingModel` over the
      provider's: a reusable call is answered from the store (zero tokens,
      zero cost, the original's provider, model, request and raw
      response); a stop asked for ends the attempt before the next call,
      never inside one. (2) Migration 20261019003000: the column
      product_model_calls.resumed_from_model_call_id, which the admission
      requires to name a call of the same section and kind and to spend
      nothing; `attempt_token` on every failure record of error_history;
      the lease recovery's record of the expired attempt (code
      SECTION_LEASE_EXPIRED, the token, the lease's expiry);
      product_phase2_release_section, which hands a claim back without a
      failure: PENDING, the attempt refunded, worker, token and lease
      cleared, the reason with the parts done on the history. (3) The
      runner: a WORKER_STOP_REQUESTED out of an attempt releases it
      (reason WORKER_STOPPED, the calls, kinds and parts done, parts
      total) and leaves the loop; `prepareResumption` reads the claim's
      history and the section's stored calls (`loadSectionModelCalls`)
      and logs ATTEMPT_RESUMABLE and CALLS_REUSED. (4) The hosted worker:
      SIGTERM, SIGINT and SIGHUP request a stop (the loops end after the
      call in flight, the attempt is released, exit 143 with
      PRODUCT_HOSTED_WORKER_STOPPED); its worker ids name the sandbox the
      wake passes as PRODUCT_SANDBOX_NAME ("product-hosted:<sandbox>:
      <pid>:<loop>"); at start it hands back the claims of its own
      sandbox's dead processes (`releaseDeadClaims`: a RUNNING row whose
      worker id names this sandbox, or none, and a pid that is not alive;
      reason WORKER_RESTART with the parts the dead attempt's stored
      calls show) instead of waiting the lease out; so the wake after a
      restart resumes the section with no operator retry. A session end
      that kills the process outright leaves nothing at death; the next
      worker's start, or the lease recovery, writes the record. How a
      resumed attempt's call records read: the committed attempt's set is
      its own calls plus one record per reused call under its own
      invocation identities, each naming the original in
      resumed_from_model_call_id, with the original's request and raw
      response and zero tokens and cost; the originals keep their rows
      and their cost; the section row's cost is the section's whole spend
      across attempts, the reused records adding nothing; the Review read
      lists a section's calls across its attempts as before, the
      proposals of the reused parts citing the new records. For E's
      ledger: spend from the cost columns is right as it stands; usage
      read from a record's raw response should skip records with
      resumed_from_model_call_id, or it counts the original's tokens
      twice; SQL 7's "kept" set already counts the reused records as the
      committed attempt's. Proof on the database harness
      (tests/product-attempt-resume-db.test.js, local Postgres 16, every
      migration): the Concho run with the synthetic model stopped once
      part 1 of the first section the runner splits had completed: the
      row PENDING, attempts 0, history [{attempt 1, the token, WORKER_
      STOPPED, parts_completed [1], parts_total N, kinds routing, residual,
      extraction, calls 3}], the three call rows under that token; the
      plain resume: the provider asked for parts 2 to N only, the three
      reused calls recorded under the new token with zero cost naming
      the originals, the row's cost the first attempt's spend plus the new
      parts, the run READY, every proposal citing a committed record; the
      dead-claim release of a claim whose worker is "product-hosted:
      pm-codex-preview-worker:999999:2" (another sandbox's live claim left
      alone), the lease recovery's record with the token, a part failure's
      record with the token and the part (routing, residual and part 1
      then eligible), the release's stale-token and empty-reason refusals,
      the admission's refusals of a resumed call naming no original or
      spending. tests/product-attempt-resume.test.js (fakes): the identity
      across the three shapes and under a re-split, the reuse rule per
      history code, the resuming model, the stop between calls, the
      dead-claim release, the runner's release, the worker's signal, ids
      and start. What the rule would have spared on NCS generation 5, from
      product_model_calls by invocation identity (the committed attempt's
      token per call kind and part) and the part each request carries:
      5.8, the restart with the same split of four, the committed attempt's
      repeat of routing ($0.022), residual ($0.036), part 1 ($0.675) and
      part 2 ($1.862): $2.596 and 749 seconds; 5.1, whose attempts 2 and 3
      followed cap failures on part 2 (recorded without the part then, with
      it now), their repeats of routing, residual and part 1: $1.174 and
      349 seconds, $1.110 and 308 seconds; attempt 4 re-split the section
      into four parts and would reuse nothing. In all $4.88 and 23.4
      call-minutes, 35 per cent of the $13.84 and 34 per cent of the 69
      call-minutes the ledger counts on attempts that never committed;
      the rest is the cap on 5.1's part 2 ($5.73, E's lever), 3.4's answer
      that was not one object ($1.19, a whole-call failure, nothing
      reusable by rule), the 1.2, 2.1 and 2.2 pairs ($0.64, a residual
      consistency refusal and the store defect of (77), both since fixed),
      and the interrupted attempts' own first calls. Not changed: the
      lease recovery still counts the lost attempt (a worker handing its
      claim back refunds it); the launcher and the sandbox wake's command
      are unchanged but for the sandbox name in the environment; nothing
      in the request or response contract or the adapters (E's). npm run
      test:active: 788 tests, 787 pass, the one failure the known Codex-client final-message test. The database step, every file alone on local Postgres 16 with the 43 migrations: 20 files, 44 tests of 44 pass (the new proof 99 s). One commit
      for code, migration, tests, the guide lines and this finding.
      (142a) 2026-10-19 03:15 UTC (implementer D), on the manager's
      message of 02:15 UTC (received 03:10, after (142) was pushed as
      7c998af and the merge 2318916; the merged tree ran npm run
      test:active at 819 tests, 818 pass, the one known failure, and the
      runner-driven database tests clean). The two subscription runs read
      by SQL at 03:12 UTC: both RUNNING again (the manager's retries of
      02:25), each with two sections claimed by the live worker
      product-hosted:17:1 and :2 (leases to 02:43) and every other section
      PENDING. What the rows say of the stop: each run has one history
      entry, at 23:01 UTC, "claude exited 1: API Error: This request would
      exceed your account's rate limit" on part 2 of a split section
      (686c3bf2: 3.20, part 2 of 3, 8,630 bytes; f1e2493f: 3.18, part 2 of
      5, 13,221 bytes), the part named in the message only, no attempt
      token and no part field (the deployed worker predates D3's
      failureRecord), and nothing at all from the sandbox sessions' end
      before 02:11: the lease recovery of that worker wrote `error` alone
      and the retry's claim cleared it, the 5.8 pattern again. Under D3 as
      deployed from now on: the rate-limit failure would carry the token
      and the part, so the retry's attempt would reuse routing, residual
      and part 1 and ask the provider for part 2 onward; the session's end
      would be written by the next worker's start (WORKER_RESTART, the
      parts done) or by the recovery (SECTION_LEASE_EXPIRED with the
      token), and the attempt resumed either way. The sandboxes carry
      D3's worker only once the manager updates them (update-sandbox-
      worker.js, skipped while a worker holds the lock) and applies
      migration 20261019003000 to the preview branch first, as with
      (140)'s.

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
      (100) 2026-10-18 19:15 to 20:30 UTC (implementer B), Phase 6
      engineering without the cutover: the load. Read first, from the
      preview branch (ecrtoofsyxozazkvsvcl) by SQL: product_agreement_
      releases and product_agreement_release_heads are empty for every
      source; Metsera generation 8 (run 72d94dd2) is READY with 974
      proposals and has no review session at all (the seven sessions that
      exist are all DRAFT; NCS generation 1 is the only one with
      decisions, version 45, 5 decided of 1,672); the production project
      (tzulhdasmioeechxapdy) has none of the product_ tables. So "the
      reviewed candidate" of Phase 6's second box is, in the database, an
      undecided draft: the Phase 3 rule (product_phase3_save_review,
      PUBLISH) publishes only a review with every item decided and
      coverage confirmed, and publication is itself the inactive release
      pointer: PUBLISH inserts an immutable release whose
      supersedes_release_id is the source's current head and leaves the
      head alone; only ACTIVATE_RELEASE (after EVALUATE_RELEASE's lawyer
      attestation) moves it; ROLLBACK_RELEASE moves it to the superseded
      release. Built on that rule, nothing new in the database:
      lib/product/cutover-client.js (one client over the product's own
      routes, the deployment through PRODUCT_INTERNAL_TOKEN with
      --base-url, or the route handlers in-process over a service-role
      client; the run route that wakes the worker is absent by design),
      lib/product/published-facts-handler.js (the published read as a
      factory, the page unchanged), lib/product/release-candidate.js and
      scripts/product/load-release-candidate.js: `--run <id>` reads the
      review workspace and reports readiness (pending, unresolved,
      decisions by kind, coverage, the run's releases, the source's
      pointer); `--publish` sends the page's own PUBLISH and then proves
      the release exists, the pointer did not move and the published read
      is unchanged. It never decides an item (Ben's standing rule;
      OPERATING-RULES: "Only a lawyer-accepted fact is final for the
      internal release") and never activates. On Metsera generation 8
      the check says: no review session, then about 1,600 items pending;
      the load runs the minute Ben's decisions are in (the review page,
      or the manager on Ben's word), as one command. Tests:
      tests/product-cutover-scripts.test.js (the real handlers over an
      in-memory store keeping the release rules: refused while pending,
      published inactive once decided, refused again once PUBLISHED) and
      tests/product-phase-6-db.test.js ((104) below). Plan evidence, a
      correction proposed and not made: Phase 6's first box restored the
      backup to the preview branch, and "Switch private Review to the
      accepted V2 release" reads as a pointer move on that database; the
      production project has no product schema, so a Review on production
      needs the 41 migrations applied there and the reviewed source, run
      and release rows carried over, which no script does. The manager
      should say which database the released Review runs on; the scripts
      work on either through --base-url.
      (101) 2026-10-18 20:30 to 21:20 UTC (implementer B), the V1 against
      V2 comparison. lib/product/generation-comparison.js and
      scripts/product/compare-generations.js: a Markdown report pairing a
      V1 generation's facts with a V2 generation's on the agreement's
      bytes (a V1 fact's cited spans against a V2 fact's own component
      bytes, the rule of lib/product/review-comparison.js; half or more
      of the cited bytes is a counterpart, some is partial), by section
      (routing with the families V2 adds or drops and the widening by
      code, coverage states, each V1 fact with its best V2 counterpart,
      facts new to V2, facts V2 held with their issue codes, the V1
      reviewer's decision and comments beside the fact) and by table
      (each V2 row's V1 counterparts, V2 facts without a readout, V1
      families with no V2 table). Inputs: run ids through either
      transport, or `{ analysis, review }` files. Test on fixtures:
      tests/product-generation-comparison.test.js. Run on NCS generation
      1 (eaafcac8, V1, Ben's review at version 45) against generation 4
      (39456f2d, V2, prompt V8; generation 5 was still running), the
      inputs assembled from the preview branch's tables by SQL (no
      deployment token here): V1 982 valid facts, 649 with a V2
      counterpart, 231 partial, 102 without, and 84 of those 102 overlap
      a fact V2 held; V2 850 valid, 32 new to V2, 145 held (92
      INVALID_FACT_COMPONENTS, 45 DUPLICATE_FACT_OCCURRENCE); 43 of 104
      sections route differently, mostly V2 adding a family (3.5:
      IMMATERIAL in V1, REPRESENTATIONS in V2 by the article heading
      rule, four new facts). Read, not just counted: the partials sit in
      REPRESENTATIONS (109 of 216) because a V1 representation cites the
      whole sub-section ("Except as set forth ...") while a V2 fact's own
      words are one limb, a counterpart in substance and a partial on
      bytes; EMPLOYEE_MATTERS falls 59 to 33 and CONSIDERATION 105 to 60
      because V1 wrote one fact per sentence where V2 writes one per
      operative effect; the V2 loss is mostly validation holds, not
      misses. Generation 4 has no readouts, so the by-table part is lists;
      the table comparison is generation 5's once READY (`--v2-run
      51577c57`). The report is docs/codex-program/notes/
      NCS-V1-V2-GENERATION-COMPARISON-2026-10-18.md (evidence, 2,300
      lines). Not a plan equality: the report names each difference and
      its reason.
      (102) 2026-10-18 (implementer B), the outside-in smoke test.
      lib/product/smoke-test.js and scripts/product/smoke-test.js: dry
      run only: the intake (POST /api/product/intake), the run status
      read, the provisions page read (the preview route the page polls),
      the published read and the three page shells; the run route is
      never called, so no model call and no cost follow. The intake's own
      rule, read in product_phase1_create_run: a submission whose
      fingerprint (source, schema, prompt bundle, model config, explicit
      generation, attempts) matches an earlier run returns that run; any
      other creates the next generation as a QUEUED run with no worker,
      and the report says which happened. On the cutover's live deal
      that is the intended path: the smoke test's intake is the
      generation Ben will then start with start-generation.js. Proof in
      tests/product-phase-6-db.test.js: the Concho URL under a new
      fingerprint created generation 2 QUEUED with zero model calls; the
      status read answered runStatus, the preview read zero sections, the
      published read no entry; on the analysed run, draftAnalysis READY.
      Not run against deal-corpus-preview from here: this environment
      holds no PRODUCT_INTERNAL_TOKEN, and its SUPABASE variables point
      at the canonical-v2 staging project (sjumbznveyyiizhwvixj), not the
      preview branch, where the direct transport answers 500 as expected
      without the product tables. The manager runs it with the token:
      `PRODUCT_INTERNAL_TOKEN=... node scripts/product/smoke-test.js
      --base-url https://deal-corpus-preview.vercel.app --run
      72d94dd2-cb59-49cf-8f46-c89d161b7769`.
      (103) 2026-10-18 (implementer B), the rollback drill.
      lib/product/rollback-drill.js and scripts/product/rollback-drill.js:
      for the run whose release is current, ROLLBACK_RELEASE through the
      review route, then the pointer and the published read checked (the
      prior release's publication: same run, same released_at, same
      layered fact count), then ACTIVATE_RELEASE of the same candidate
      (`--no-restore` stops after the rollback); every release stays
      stored. The production switch is never run from here. Proof in
      tests/product-phase-6-db.test.js: release 1 activated, the drill
      refused ("supersedes nothing"); after reopen, one edit, publish
      (release 2 supersedes release 1, pointer still on 1), evaluate and
      activate, the drill moved the pointer to release 1 with the
      published read showing publication 1, then back to release 2; the
      revisions end ROLLBACK_RELEASE, ACTIVATE_RELEASE. Plan evidence:
      for the first release of a source the database refuses the
      rollback ("no prior active release exists", the Phase 3 function),
      because the prior view of a first release is "no published release"
      and the pointer cannot express it. So Phase 6's "Execute rollback
      once and prove the prior view returns" cannot run on Metsera's
      first release as the boxes are ordered. Two ways, Ben's or the
      manager's to pick: (a) run the drill on the second release, which
      Ben's first correction after live use produces (reopen, edit,
      publish, evaluate, activate, then the drill), or (b) a migration
      letting ROLLBACK_RELEASE delete the head row when the active
      release supersedes nothing, the drill then proving the published
      read shows nothing for the source. Not built: a database decision.
      (104) 2026-10-18 (implementer B), the database proof and what it
      showed about the estate. tests/product-phase-6-db.test.js applies
      every migration (41 files, in order) on an inactive Postgres 17 in
      one rolled-back transaction, runs the Concho synthetic draft, and
      drives the four scripts through the route handlers as (100) to
      (103) say; about 150 s, mostly the synthetic runner; added to the
      CI database job. The synthetic draft on the full migration set
      leaves coverage UNRESOLVED, which the release evaluation refuses
      until each is resolved as a reviewed omission; the test supplies
      those resolutions as the lawyer would, through the command.
      Observation: tests/product-phase-3-db.test.js fails on a fresh
      Postgres 17 (and on PGlite) at the first recorded model call,
      "invalid product model invocation identity", because it applies
      16 of the 41 migrations while the runner has recorded part
      identities (`<attempt token>:part-<n>`, 2026-09-14) that only
      migration 20260914125500 onward admits; the CI workflow runs on
      pull requests only and this branch's last workflow run is
      2026-09-05, so the database job has not run since. Proposed: the
      Phase 1 to 3 database tests apply the full migration list, as the
      new test does. Environment: the cloud container has no Postgres
      binary; an embedded Postgres run as a non-root user under
      /home/user/.cache served the database tests. npm run test:active
      with the two new files: 711 of 712 before the merge with the other tracks' pushes and 752 of 753 after it, the one failure the known Codex-client final-message test; the database test passed again on the merged tree with its 42 migrations. One commit for code, tests,
      the evidence note, the guide lines and these findings.
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
      (94) 2026-10-18 20:40 UTC (implementer A), work package 18 (the
      manager's message of 20:05 accepting finding (91)'s proposal; the
      message says "finding (93) in your range", which the NCS read of
      20:02 had taken, so this is (94)). (a) A quote of inherited origin
      (INTRO, CHAPEAU, DEFINITION, CROSS_REFERENCE) cited on a span the
      closure knows that does not hold it is taken from the one closure
      span of a kind its origin allows that holds it verbatim
      (lib/product/agreement-draft.js resolveEvidenceQuote, after the
      full-section scan: the matching loop is now matchesWithin(span);
      the known-span case sets the same context as work package 13 (a),
      so the COMPONENT_SPAN_RELOCATED note is the same note, its entry
      carrying known_span: true to say the id written was a known span);
      two candidates or none keep the hold ("byte range missing"); own
      words are never moved across spans. Test with NCS 4.7's real words:
      the Article III and IV chapeau spans and 4.7 as stored for the run,
      the three INTRO quotes cited on the Article III span relocate to
      the Article IV chapeau at their byte offsets, VALID with the note;
      a twin chapeau span keeps the hold; an OWN quote on the known span
      keeps the hold. Every stored fact the rule would have kept VALID,
      from the rows on the preview branch (every non-VALID fact of NCS
      generation 5 and Metsera generation 8 with a top-level component of
      inherited origin on a known span lacking its quote, counted against
      the closure's spans of the allowed kind): NCS 4.7's three
      (24a5363e, a8752fe4, 0adef215; nine components, each with exactly
      one holder, the Article IV chapeau c0b36c15); Metsera generation 8:
      none. (b) An AMOUNT whose words name a reference quantity and state
      no number carries { canonical: null, unit: null, form: 'REFERENCE' }
      and a VALUE_IS_REFERENCE note (lib/product/fact-components.js
      isReferenceValue: a quantity noun (amount, premium, price, fee,
      sum, cost, value, consideration, payment, expense, salary,
      compensation, rate, balance) with where it is set forth
      ("set forth in", "specified in", "described in" ...) or the payment
      it was ("last ... paid", "most recent ... payable", "current ... in
      effect"); a Section, Schedule or Rule citation is not a number; a
      digit, a count in words or a formula is not a reference;
      buildComponentTree returns references beside formulas, the
      validator accepts the form, the extractor notes it; contract R6
      says so). Evidence: NCS 5.11's aeb3313d, "the last aggregate annual
      premium paid by the Company prior to the date hereof", the one
      stored fact of either run the rule keeps VALID (the other four
      AMOUNT holds in the stored rows are work package 14's none-counts
      and formula, held before that package reached the deploy). Tests:
      the unit cases, the tree, and a compiled 5.11 fact VALID with the
      note beside a prose amount that still holds. (c) The publicity
      row's sub-items: the general covenants table's "Public
      announcements" row carries detail_labels_by_row and a new
      detail_from_words_by_row (scripts/product/table-shapes-decision-34.js
      PUBLICITY_DETAILS and PUBLICITY_WORDS; lib/product/table-shapes.js
      validates each rule's detail against the row's labels and each
      pattern; the contract regenerated, 49 tables, 158 columns). The
      rule, lib/product/fact-conclusions.js detailFromWords: the first
      rule matching the fact's own components, else its statement and
      summary, names the sub-item; the rule wins over the detail the
      model wrote so a corpus reads in one vocabulary, a fact no rule
      names keeps the model's detail. Applied at extraction
      (agreement-draft, note ROW_DETAIL_FROM_WORDS naming from and to) and
      to stored facts in buildTableView, so NCS generation 5's rows read
      this way without a run. The labels, proposed for Ben to name, in
      the order the sub-items show: Announcement release; Consent to
      releases; Consultation and review; Consistent with prior
      statements; Carve-out: ordinary course; Carve-out: employees;
      Carve-out: disputes; Carve-out: investor and media communications;
      Carve-out: sponsor disclosure; Law or exchange exception. The rules
      read the carve-outs and the consistency proviso before the duties
      they qualify (NCS's "without providing the other Parties the
      opportunity for such consultation and review, issue a press release
      ... consistent with prior press releases" is the consistency line)
      and the Law or exchange exception last, since every duty repeats
      it. On NCS 5.14's twelve stored facts: Announcement release 2 (the
      joint release; its approval), Consultation and review 2 (the
      consult-and-review duty; the no-issuance-before-consultation duty),
      Consistent with prior statements 1, Carve-out: ordinary course 1,
      employees 1, disputes 1, sponsor disclosure 3 (limited partners;
      the website posting; the sponsor consistency proviso), Law or
      exchange exception 1. On Metsera generation 8's publicity row (6.08,
      seven stored facts with seven model-written details, not five):
      Announcement release (the initial press release), Consent to
      releases (the prior written consent; its not-unreasonably-withheld
      standard), Consultation and review (consult; review and comment),
      Consistent with prior statements (previously approved information),
      Carve-out: investor and media communications (analysts, investors
      and media): five lines in the shared vocabulary where the model had
      seven of its own; the manager judges whether that is improved. Both
      deals pinned in tests/product-table-view.test.js with the facts'
      own words; the shape pinned in tests/product-table-shapes.test.js
      (labels, rule order, a rule naming no label fails validation); the
      extraction path in tests/product-fact-components-extraction.test.js.
      docs/core/CODEBASE-GUIDE.md updated. npm run test:active: the known
      failure only (the count in the commit). Nothing submitted or
      retried.
      (95) 2026-10-18 21:05 UTC (implementer A), work package 18 items
      (d) and (e) (the manager's message of 20:28, finding (93) accepted
      as (162)). (d) The general covenants table has a fixed "Registration
      rights" row (scripts/product/table-shapes-decision-34.js
      REGISTRATION_ROW, REGISTRATION_WORDS, REGISTRATION_DETAILS,
      REGISTRATION_DETAIL_WORDS; the contract regenerated). Its words_rows
      rule, "Registration Statement", "Registrable Securities", a
      prospectus, "Rule 144" or "Rule 415", is marked over_readout, a new
      flag lib/product/table-shapes.js validates: lib/product/
      fact-conclusions.js rowFromWords moves a fact whose readout is on
      another row of the same table to the rule's row when its own
      components (else its statement and summary) match, or when the open
      row the model wrote begins with the rule's row label ("Registration
      rights indemnification" is "Registration rights"; the survival and
      reimbursement limbs name none of the words); the readout-less case
      stays with defaultConclusions. Applied at extraction (agreement-
      draft, note ROW_FROM_WORDS naming from and to, before the sub-item
      rule) and to stored facts in buildTableView (page_rule 'words_rows',
      row_from), so NCS generation 5's rows read this way without a run.
      The sub-items, proposed for Ben to name, in the order they show:
      Resale registration; Effectiveness and amendments; Stockholder
      information and approval; Indemnification; Expenses; Rule 144 and
      legend removal; Listing and reporting. The rules read the indemnity
      and its mechanics first (its limbs name a prospectus), then
      expenses, then listing and reporting before Rule 144 (the reporting
      covenant names Rule 144 too), then the stockholders' approval right
      before the resale filing it governs, then effectiveness and
      amendments last. On NCS 5.17's 32 general-covenant facts, checked
      against the stored rows with the same patterns: 29 move to
      Registration rights (Resale registration 3: the Rule 424(b)(7)
      supplement, the Rule 415 shelf alternative, the selling
      securityholders; Effectiveness and amendments 5: keeping the
      statement effective, the amendments, the SEC's requests, the
      misstatement notice, the prospectus correction; Stockholder
      information and approval 4: review and approval of their
      disclosures, the filing bar without it, the information they
      furnish, the furnished-information scope; Indemnification 8:
      Parent's indemnity for untrue statements and for omissions, its
      carve-out for furnished information, its expense reimbursement,
      the stockholders' several indemnity, their reimbursement, the net-
      proceeds cap, survival; Expenses 1; Rule 144 and legend removal 3:
      legend removal, Rule 144 resales, Rule 144(c)(1) compliance;
      Listing and reporting 5: Nasdaq listing, Nasdaq compliance, DTC
      eligibility, the two reporting covenants); 3 stay where they are,
      the Nasdaq notices (deficiency notices and delisting events on
      "General notification", Nasdaq or SEC proceedings on "Litigation
      notification"), which name none of the words and are notification
      covenants. The nine CAPITALISATION facts are not on this table
      (question (g) is with Ben). Metsera generation 8: no general-
      covenant fact names any of the words, so nothing moves. Pinned in
      tests/product-table-view.test.js with fifteen of the facts' own
      words (the seven sub-items, the notice that stays, the survival
      limb that comes by its label), tests/product-table-shapes.test.js
      (the row, the rule, the labels, a non-boolean over_readout fails)
      and tests/product-fact-components-extraction.test.js (a General
      notification readout moves at extraction with both notes). (e)
      lib/product/source-context.js resolveReferencedNode: a reference
      inside an exhibit or annex resolves within the exhibit first: to a
      node of the exhibit's own when the exhibit's sections have nodes
      (the phase-1 fixture's Exhibit-A::10.02; unchanged), else to the
      exhibit itself when a heading of the exhibit's text starts with the
      number as the reference writes it (exhibitHoldsReference: "2.2" is
      the CVR Agreement's own "2.2 Nontransferable", "2.01(b)" is not,
      since the exhibit writes 2.1, so "Section 2.01(b) of the Merger
      Agreement" still reaches the main agreement); such a reference is a
      cross-reference to the exhibit's own words (the exhibit node is the
      target, its CROSS_REFERENCE span the exhibit) and is recorded in
      context_diagnostics.exhibit_internal_section_references, a key
      present only when non-empty so every other closure's identity is as
      it was; a number the exhibit does not hold goes to the main
      agreement as before. The extraction gate in agreement-draft
      (traversal complete and nothing unresolved) is unchanged and now
      passes for the exhibit. On the Metsera filing as fetched
      (tests/fixtures/canonical-v2/metsera-first-live-run), Exhibit-B's
      closure: unresolved none (was six), internal 24 (2.2, 2.4, 2.4(a),
      2.4(e), 2.4(i), 2.6, 3.2, 3.3, 3.4, 4.2, 4.3(a) to (d), 5.1,
      5.1(a), 5.2(a), 5.3, 6.12, 6.2, 6.5, 6.6(a), 6.8, 6.9), cross-scope
      into the main agreement 2.01(b) and 2.03 (was seventeen),
      traversal complete, 17 spans (6 definition spans, 7 cross-reference
      spans). Exhibit-A (the Form of Support Agreement) has no section
      references and is unchanged. tests/product-exhibit-references.test.js
      pins this on the fixture beside the main agreement's 6.03, which
      resolves as before; tests/product-phase-1.test.js's exhibit-scope
      test still passes. The families Exhibit-B would be extracted for
      are the thirteen its generation 8 routing holds: CONSIDERATION,
      DNO_INDEMNIFICATION, EMPLOYEE_MATTERS, GENERAL_COVENANTS,
      KEY_DEFINED_TERMS, MISC_BOILERPLATE, REPRESENTATIONS, TAX_MATTERS
      and TERMINATION from the router, CAPITALISATION, DIVIDENDS,
      MERGER_STRUCTURE_CLOSING and SPECIFIC_PERFORMANCE_REMEDIES widened
      from the residual pass. What the next Metsera run would carry, by
      that routing's own reading of the exhibit: the CVR consideration
      (the per-CVR milestone payment amounts, the milestone payment
      dates and the payment procedure of 2.4, the exchange and payment
      mechanics, the abandonment right of 2.6), the defined terms
      (Acting Holders, Change of Control, Commercially Reasonable,
      Permitted Transfer, the milestones), the CVR covenants (the
      development spend commitment, the anti-avoidance covenant, the
      assumption on a Change of Control, direction and control of the
      business), withholding and the intended tax treatment, the Rights
      Agent's indemnification and expense reimbursement, Parent's
      authority and no-conflict representations, the Equity Award
      Holders' payment timing, 6.12's termination and the boilerplate;
      the generation 3 audit's missing milestones and payment dates
      among them, as facts rather than the nine unusual-provision flags
      that are their only trace today. Whether they land on tables
      depends on the shapes (the CVR row of the consideration table and
      the general covenants "CVR Agreement" row exist); the facts will
      exist either way. The seventy-seven-kilobyte exhibit has no child
      limbs, so it is extracted by its paragraphs under the long-section
      rule. docs/core/CODEBASE-GUIDE.md updated. npm run test:active: the
      known failure only (the count in the commit). Nothing submitted or
      retried.
      (96) 2026-10-18 21:30 UTC (implementer A), work package 18 as
      revised by the manager's message of 20:48 on Ben's answers in
      finding (163); (95)'s (d) and (e) are superseded by this finding.
      Ben's words, verbatim, now in the code comments where a change
      answers them: "For CVRs - I want to build a separate product for
      that os I'd leave those"; "on A - if the shareholders have to do
      something, okay for them to be an obligor. Ok on ETA on covenants.
      reg rights I think goes with consideration (but at bottom)". (a),
      (b), (c) stand as delivered in (94). (d) revised: the general
      covenants table no longer has a Registration rights row; a table
      consideration-registration-rights is the last table of the
      Consideration section (scripts/product/table-shapes-decision-34.js
      REGISTRATION_TABLE_KEY; one fixed row, the seven sub-items by
      words as before, accepts_families GENERAL_COVENANTS, which
      lib/product/table-shapes.js validates and lib/product/
      fact-conclusions.js tableForFact honours). The covenants table's
      words_rows rule carries table_key (validated at document level:
      the table exists and holds the row), and rowFromWords moves a fact
      across tables as across rows (a fact on the model's open
      "Registration rights" row of the covenants table moves too); the
      extractor's ROW_FROM_WORDS note names from_table_key and
      to_table_key, the page's page_rule 'words_rows' carries the new
      table_key. On NCS 5.17's 32 covenant facts the outcome of (95)
      holds, now under Consideration: 29 on the registration table's one
      row (Resale registration 3, Effectiveness and amendments 5,
      Stockholder information and approval 4, Indemnification 8,
      Expenses 1, Rule 144 and legend removal 3, Listing and reporting
      5), the three Nasdaq notices where they were. Metsera generation
      8: no covenant names the words, so no such table. (e) revised: the
      exhibit-internal reference resolver of (95) is reverted
      (lib/product/source-context.js restored as at 858bd92,
      tests/product-exhibit-references.test.js removed; nothing of it
      remains). In its place, lib/product/agreement-draft.js
      outOfScopeExhibit: an exhibit or annex whose own text is an
      agreement (a "Form of ... Agreement" title, or "THIS ... AGREEMENT
      is made and entered into") with three or more articles or
      sections of its own is a separate agreement and out of scope.
      buildAgreementSectionDraft, after the routing and residual calls
      (the routing stays as evidence of what the exhibit holds), records
      one OUT_OF_SCOPE_EXHIBIT note on the node (section_reference,
      title, own_headings, routed_families, reason), coverage NOT_FOUND
      for the section, every family and the routed families' fact types
      (never UNRESOLVED), and makes no extraction call. On the Metsera
      filing as fetched: Exhibit-B is detected (title "Form of CVR
      Agreement", 33 headings of its own), Exhibit-A (the Certificate of
      Incorporation of the Surviving Corporation, 100 bytes) and 6.03
      are not; the draft of Exhibit-B with a model that answers routing
      and the residual pass and would throw on extraction makes those
      two calls only, holds one note, no proposals, no UNRESOLVED
      assertion (tests/product-out-of-scope-exhibit.test.js). On the next
      Metsera run the 51 REQUIRED_FACT_TYPE_UNRESOLVED issues from
      Exhibit-B become this one note; the residual pass still runs on
      the exhibit, so its unusual-provision flags remain as they are
      (the manager may want them silenced too; not changed here). The
      provisions page lists the exhibit under a quiet line in the style
      of the schema-drift lines ("Out of scope: Exhibit B, Form of CVR
      Agreement, a separate agreement; not extracted in this product.";
      lib/product/provisions-preview.js out_of_scope,
      pages/review/product/[id]/provisions.js, data-testid
      preview-out-of-scope; tests/product-provisions-preview.test.js).
      (f) OTHER_PARTY: the obligor vocabulary of the general covenants
      and registration-rights tables has OTHER_PARTY ("Other party
      (named in the words)"), the column's other_party_code names it,
      the guidance tells the extractor to cite the party's own words;
      the page shows those words in the cell (lib/product/table-view.js
      otherPartyWords: the cited component else the fact's own ACTOR)
      and derives the cell for a stored fact whose obligor is empty and
      whose ACTOR is neither the Company, Parent, Merger Sub nor "each
      party" (otherPartyCell, derived 'other_party'). On NCS 5.17's
      several indemnity (37ea48cb, "Each Specified Stockholder ...
      indemnify and hold harmless") the Indemnification sub-item's
      obligor reads "Each Specified Stockholder" beside Parent's;
      pinned in tests/product-table-view.test.js. (g) By when: a
      verbatim column byWhen (fill_from TRIGGER and PERIOD,
      fill_from_components, validated) on the general covenants,
      registration-rights and financing tables, before the as-drafted
      column, which on those tables cites TRIGGER and PERIOD too; the
      page fills it from the fact's own components in source order when
      the readout has no cell (fillFromComponentsCell, derived
      'fill_from_components'), never repeating a component a value
      column of the same table reads, and pruneEmptyColumns hides it
      when no row fills it. On NCS 5.17's Rule 424(b)(7) filing
      (2bf58d52) the Resale registration line reads "Promptly following
      the Closing Date (and in any event no later than two Business Days
      thereafter)"; on a covenants table no row of which states a
      deadline the column is hidden. On NCS 5.18's payoff letter the
      financing table's Period column already reads 3 business days
      from the PERIOD component (work package 7's rule), so By when
      shows nothing there and is hidden, the as-drafted words now citing
      the period; a By when that repeated the Period number would have
      been the duplication Ben's column rule forbids. The Decision 34
      test that no fact table carries a free-text column admits the By
      when column alone, on Ben's words. Shapes regenerated: 30
      sections, 50 tables, 164 columns. docs/core/CODEBASE-GUIDE.md
      updated. npm run test:active: the known failure only (the count in
      the commit). Nothing submitted or retried.
      (97) 2026-10-18 21:55 UTC (implementer A), Ben's (166) applied and
      work package 19 from the manager's (165). Ben on the registration
      sub-items, verbatim: "are these from a reg rights agreement? I
      wouldn't go into anywhere near this depth in this product": the
      consideration-registration-rights table is now no_sub_items (a new
      table flag, validated), one line, present or absent, its facts
      behind it; a fact's row_detail is dropped at extraction and on the
      page; the seven labels of (95) and (96) are withdrawn from the
      shape (fb98374). Ben on the publicity labels: "all sounds fine";
      nothing changes. Work package 19: (a) 3.4's ten status
      representations cite the Article III chapeau on a span id one hex
      character off: work package 13 (a)'s rule, already in the code,
      VALID on the next generation. (b) 6.2's two bring-down tiers
      (7c534651, d2f8a9b9) list the representations they cover as a LIST
      of CROSS_REFERENCE children, each resolved to its section, and
      were held "LIST without LIST_ELEMENT children": a LIST whose
      children are all CROSS_REFERENCE or DEFINED_TERM components is a
      list of references and valid (lib/product/fact-components.js);
      a list of plain terms still needs its elements. (c) 6.4's three
      frustration facts (78926bd5, 7589b03e, fc6c34bd) cite "this
      Article VI" as a CROSS_REFERENCE with nothing to resolve to: a
      reference to the words' own article, section or agreement ("this
      Article VI", "this Section 5.2", "this Agreement", "hereof") needs
      no resolution (SELF_REFERENCE, beside the statute exemption). Both
      pinned in tests/product-fact-components-contract.test.js; the
      five facts are VALID on the next generation. (d) The rest of the
      holds are work packages 14 and 18 (a) and (b), in the code since
      their merges. (f) The registration-rights table at the bottom of
      Consideration: (96) and fb98374. (g) The manager's reading that
      the row move "does not happen on the stored rows (29 facts stay on
      General notification with the sub-items)" was of a preview
      deployed before the rule: the deployment of 532ca9f, which carried
      it, was created at 20:50:39 UTC (Vercel deployment
      dpl_3kPAHeNCx78v6EXjwPg1btdz8WsV), and the generation 5 audit's
      preview read fell between the run's READY at 20:48 and that
      deploy's readiness. On the real rows it does happen: the 32
      general-covenant facts of 5.17 as stored (read from the preview
      branch; ids shortened, components flattened), through
      buildTableView with the generated contract, give one Registration
      rights line under Consideration with 29 facts, no sub-rows, and the
      three Nasdaq notices on General notification (two) and Litigation
      notification (one); nothing without a readout. Pinned with those
      rows in tests/fixtures/product/ncs-generation-5-5-17-general-
      covenants.json and tests/product-table-view.test.js. Two things the
      real rows showed that the fixtures had not, fixed and pinned: the
      page's derived OTHER_PARTY obligor took the model's ACTOR
      "Statement (or any prospectus or prospectus supplement forming a
      part of such Registration Statement), as initially filed" for a
      party, so the words must now name a person or body (PARTY_NOUN); and
      By when took every TRIGGER, including "upon the discovery of the
      happening of any event", "insofar as such losses ... arise out of"
      and "as such expenses are incurred", so a TRIGGER fills it only
      when it states a time (TIMING_WORDS: days, dates, the Closing,
      promptly, within, prior to, following, after, until ...); a PERIOD
      always does. On the line as it now reads: obligor "the Specified
      Stockholders", "Each Specified Stockholder" and "Parent and each
      Specified Stockholder" shown, Parent's own readings stated in the
      summaries and kept under stated_in_summary by work package B4's
      rule; By when seven readings, the Rule 424(b)(7) deadline first;
      standards six codes. One line carrying 29 facts' readings is what
      Ben asked for; if it reads as too much, the as-drafted summaries
      behind it are the next layer and the manager decides. Metsera
      generation 8: unchanged, no such table. docs/core/CODEBASE-GUIDE.md
      updated. npm run test:active: the known failure only (the count in
      the commit). Nothing submitted or retried.
      (98) 2026-10-18 22:25 UTC (implementer A), work package 19 on the
      manager's terms of 21:00 (delivered 21:20, after (97) had gone up
      on the (165) text; the manager's message asks for finding (95),
      which (95) already is, so this is (98); (97) stands for what it
      says). (a) The unknown-span relocation the manager describes is
      work package 13 (a)'s rule (plan finding (79)), in the code since
      8eb259c and tested with 3.4's case; nothing new to build. The
      note's entry now says unknown_span: true, as work package 18 (a)'s
      says known_span: true. Stored facts the rule keeps VALID, counted
      from the preview branch's rows as in (94) (every non-VALID fact
      with a component of inherited origin on a span id its closure does
      not know, counted against the closure's spans of the allowed
      kind): NCS generation 5, ten (3.4's 05e8ab96, 2ec8f972, 36b14852,
      4d765c14, 61ab1d62, 7b0b52ed, 854f8bcb, b7a123fb, b83fbcc8,
      fcc71293; 28 components, each with exactly one holder); Metsera
      generation 8, six (1dc9dadb, 8e819867, c54f636c, c7058ea6,
      dca9d348, ece4453b; one component each). (b) Decided from the
      contract and the validator: CROSS_REFERENCE (and DEFINED_TERM) are
      allowed LIST children. A list of the representations a tier covers
      is a list of references, each child already resolved to its
      section, which a LIST_ELEMENT would not be; and the stored facts
      stay VALID without a re-run, where wrapping would have needed one.
      The validator rule and the contract's R2 say so; the extraction
      instruction still asks for LIST_ELEMENT children for lists of
      things that vary. 6.2's two tiers (7c534651, d2f8a9b9) are the
      stored facts kept VALID. (c) An Article-level reference now
      resolves to the article node of the agreement structure, as the
      manager asked, not an exemption: agreement-draft.js
      resolveStructureReferences runs over the model's components
      before the tree is built (compileExtraction takes
      agreementStructure, which buildAgreementSectionDraft passes): a
      CROSS_REFERENCE the model left unresolved that reads "this Article
      N" resolves to the enclosing article whose number it names (roman
      or arabic), else the agreement's one article of that number in the
      same document scope; "this Section N.M" to that section; "this
      Agreement" to the root; the resolution's text is the node's
      heading words ("ARTICLE VI CONDITIONS PRECEDENT"). The model's own
      resolves_to, when given, stands; only the bare adverbs of
      reference ("hereof", "herein") are exempt from resolution. Test
      with a built structure (buildAgreementStructure, buildSourceClosure)
      whose 6.4 says "any condition set forth in this Article VI": the
      fact is VALID, the reference's structure_node_id is the article
      node; without the structure the same proposal is held. On NCS
      6.4's three facts (78926bd5, 7589b03e, fc6c34bd) the words are the
      same, so they are VALID on the next generation and
      FRUSTRATION_BREACH_STANDARD is FOUND rather than UNRESOLVED (the
      draft's REQUIRED_FACT_TYPE_UNRESOLVED comes from a fact type whose
      only facts are held; a VALID fact clears it). (d) Rows for the
      eight facts without a readout, by fact_type_rows keyed
      "FACT_TYPE:SUBTYPE" (scripts/product/table-shapes-decision-34.js;
      the contract regenerated, 50 tables, 164 columns): 6.1's
      Information Statement mailing takes "Other mutual conditions", a
      new row of the mutual conditions table (fact_type_rows
      GENERAL_CLOSING_CONDITION); 6.3's Closing Tax Opinion "Tax opinion"
      and its Canadian tax-deposit condition "Other conditions", new rows
      of both party tables (GENERAL_CLOSING_CONDITION:TAX_OPINION; the
      bare key), and beside them 6.3's no-Parent-MAE condition
      (e9bd4f85, the ninth readout-less fact of those sections) takes
      the "No Material Adverse Effect" row the Company's table's mapping
      named and its fixed list lacked; the party tables' statement_words
      now read the party either way round ("the obligations of the
      Company"; "the Company's obligation"), which is what kept 6.3's
      facts off their table; 7.1's two rights take "Written consent not
      delivered" and "Support agreement not delivered", new rows of the
      buyer's termination table (subtype_rows and fact_type_rows); 7.2's
      remedy entitlement "Remedies preserved", a new row of the effect
      table; 7.3's VAT warranty (the model's CONSTRUCTION) the existing
      "Construction" row; 7.5's cumulative rights "Cumulative remedies",
      a new row of the boilerplate table. The nine NCS facts, with their
      own words, each land on that row and nothing is left without a
      readout (tests/product-table-view.test.js; the shapes in
      tests/product-table-shapes.test.js; defaultConclusions' cases in
      tests/product-fact-conclusions.test.js). Metsera generation 8: its
      readout-less VALID facts (100: defined-term entries, exchange
      mechanics, equity awards, no-shop prerequisites, merger mechanics,
      appraisal, material contracts) are of none of these fact types and
      subtypes, so none moves; the page shows none without a readout as
      before. docs/core/CODEBASE-GUIDE.md updated. npm run test:active:
      the known failure only (the count in the commit). Nothing
      submitted, woken or retried.
      (99) 2026-10-18 22:40 UTC (implementer A), the manager's addenda
      of 21:10 and 21:05 to work package 19 (delivered 21:22 and 21:24).
      (f) Done before the addenda arrived, in (96) and fb98374: the
      registration rights are one row of their own small table, last in
      the Consideration section, present or absent, the facts behind it,
      no sub-items; the words rule that recognises the facts stays on
      the general covenants table and sends them there; the general
      covenants table keeps the three Nasdaq notices; the nine
      CAPITALISATION facts stay on the capitalization table (question
      (g) of (93) with Ben). Ben's words are in the code comments: "reg
      rights I think goes with consideration (but at bottom)"; "are
      these from a reg rights agreement? I wouldn't go into anywhere
      near this depth in this product"; on the publicity labels, "all
      sounds fine" (now in the PUBLICITY comment of
      scripts/product/table-shapes-decision-34.js; the ten are final);
      on the unusual provisions, "not a fact type today" (nothing
      built). (g) The manager's diagnosis was right and (97)'s was
      incomplete. The stale deploy was real, but the shape the manager
      saw ("General notification" carrying 29 facts with (95)'s sub-items
      and no "Registration rights" row) is what (95)'s code did on the
      real rows even when deployed: the general covenants table names its
      rows from the fact's subtype (row_from_subtype, subtype_rows), the
      stored 5.17 facts are GENERAL_NOTIFICATION, so a fact the words
      rule had moved to "Registration rights" on that same table was
      still named "General notification" and the rule's row became its
      sub-item, then the sub-item rule read the row_label and named the
      details; the fixture's facts carried a made-up subtype
      (OTHER_COVENANT, not in the schema) the subtype naming never
      touched, so the test moved where the rows did not. Fixed in
      lib/product/table-view.js: a fact a words_rows rule moved
      (page_rule 'words_rows') keeps the rule's row over the subtype's
      name, on the same table as across tables; pinned with a real
      subtype on the general covenants table under a synthetic same-table
      rule, and with the stored 5.17 rows (real subtypes, real fields:
      tests/fixtures/product/ncs-generation-5-5-17-general-covenants.json)
      on the registration table, where the move was already right since
      (96) because the registration table has no subtype naming. Counts
      from the real rows, through buildTableView with the generated
      contract: Registration rights line 29 facts, no sub-rows; General
      notification 2 (the Nasdaq deficiency notice and the delisting
      event), Litigation notification 1 (Nasdaq or SEC proceedings);
      nothing without a readout. Nothing submitted, woken or retried.
      (99a) 2026-10-18 21:45 to 22:25 UTC (implementer A), work package 20
      on the manager's (168) (begun on its decided terms; the formal
      message had not arrived by the push). Numbered (99a) because A's
      range (90) to (99) is spent; the plan owner's to renumber. Read
      first, from the preview branch's tables: 4.7's three facts were
      not a page-footer case. Their held evidence quotes cite the Article
      IV introduction's words on the Article III chapeau span (3d0f7a06,
      in 4.7's closure through its reference to Section 3.8); the Article
      IV chapeau span c0b36c15 holds both quotes verbatim, with the
      footer ("34") after "as follows:", outside them. Work package 18
      (a)'s relocation did not reach them because evidence_quotes carry no
      origin, and the rule keyed on the origin; the components of the
      same facts, with origin INTRO, were relocated. 5.4 is a footer case:
      "any information relating to the Transactions,\n49\nthe Company or
      Parent", where the model's TRIGGER stopped at the footer, VALID but
      short; the NCS text has 87 bare page-number lines and no "-N-"
      footers, which source-display.js did not know. Built, each as a
      rule across the corpus with tests (tests/product-fact-components-
      extraction.test.js, the work package 20 block; the page footers
      test in tests/product-table-view.test.js; tests/product-legal-
      schema-v2.test.js): (a) B's rule, lib/product/agreement-draft.js
      dropUnresolvedInherited: an inherited context component (origin
      INTRO, CHAPEAU, DEFINITION or CROSS_REFERENCE) that resolves
      nowhere after the relocation rules is dropped from the tree with
      the note CONTEXT_COMPONENT_DROPPED (path, kind, origin, label,
      quote, the id cited, the reason), never holding a fact whose own
      words resolved; an own word that fails, or a fact with no resolved
      own word, holds as before. The same at the evidence level: an
      evidence quote cited on a context span (chapeau, definition,
      cross-reference) that resolves nowhere is dropped with
      CONTEXT_EVIDENCE_DROPPED when the own evidence is exact. And the
      missing half of 18 (a): an evidence quote cited on a context span
      that does not hold it is relocated by the cited span's kind
      (CONTEXT_SPAN_RELOCATION), noted EVIDENCE_SPAN_RELOCATED; own words
      are never relocated across spans. The two earlier tests that pinned
      "two candidate spans keep the hold" (13 (a), 18 (a)) now pin the
      drop and the note. On the stored 4.7 facts the relocation applies
      (one Article IV chapeau span holds the words), so the next
      extraction of 4.7 gives three VALID facts with the note. (b)
      footerTolerantMatches in resolveEvidenceQuote: when a quote has no
      verbatim match in its span, its words in order, with any whitespace
      between them, may enclose exactly a footer line (FOOTER_GAP from
      source-display.js: "-43-", "-ii-" or a bare page number on its own
      line); a match without a footer inside is not taken, so whitespace
      alone never relaxes the verbatim rule (pinned). The span's bytes
      include the footer and its text is those bytes (rule R1 holds); the
      context records page_footer_skipped; a quote that copies the page
      number as a word ("the Transactions, 49 the Company") matches too.
      PAGE_FOOTER now hides a bare page-number line; between single
      newlines (NCS's layout) a footer at a paragraph boundary keeps one
      newline, otherwise a space; Metsera's blank-line layout is
      unchanged. (c) lib/product/representation-limbs.js fusedLimbs: on
      a REPRESENTATIONS fact, or any fact stated as a representation
      (3.27's TAX_MATTERS fact says "represents and warrants"), an own
      component opening on a finite verb that follows an own OPERATION
      with only "or" or "nor" between them in the source is the note
      FUSED_REPRESENTATION_LIMBS (the two predicates, the joining word, the
      one-effect rule); "and" is not (3.17: "is in material breach or
      default, and has not taken any action" is one status and its
      consequence). (d) exceptionOnlyRepresentation: a REPRESENTATIONS
      fact (never REPRESENTATION_QUALIFICATION, never from an article
      introduction) whose own words are an enumerated exception is held
      REPRESENTATION_EXCEPTION_NOT_A_FACT: the exception words are an own
      EXCEPTION opening on an enumerator, "except for", "other than" or
      "save for" (never "except as set forth in", the disclosure
      exception), or an own component governed by an EXCEPTION introducer
      earlier in the fact; every own component before them is shared
      verbatim with another proposal of the same call (the sentence they
      were all cut from, a non-generic shared context required); no own
      OPERATION or EFFORTS_STANDARD before them; no operative kind from
      them on. The REPRESENTATIONS layer rule (scripts/product/build-
      legal-schema-v2.js, the schema regenerated) tells the extractor both
      shapes: predicates joined by "or" are two facts; an enumerated
      exception is an EXCEPTION component, a LIST with a LIST_ELEMENT per
      item, since the representations table has no row per exception
      (MAE_DEFINITION's carve-outs keep their facts, as (168) says). Both
      detectors run over the 278 stored generation-5 representation
      facts before the rules went in (scratch script, bytes only; the
      "or" gaps confirmed from the canonical text): (c) fires on exactly
      the three fused facts (3.27 twice, 4.13 once) and on nothing else;
      (d) on exactly twelve facts, 3.5(b)'s four, 4.4(b)'s four and
      3.7's four ("except (a) to the extent accrued ..., (b) for
      liabilities in the ordinary course ..."), none other of the 278.
      Plan evidence: B's "(7) ten facts of 3.5, 4.4 and 5.1" is twelve of
      3.5, 3.7 and 4.4 on this read; 5.1 has no representation facts
      (its EXCEPTION facts are the covenant's general exceptions, cells
      of the interim operating table, which has them). Residual risk of
      (d), for the manager: a representation whose own verb the model
      labelled QUALIFIER and whose exception facts copy its words could
      be held with them; the hold is a VALIDATION issue carrying the
      rule, reviewable, and the layer rule reduces the shape. The
      manager's formal message (21:40 UTC, read at 22:11 after the work
      was built on (168)'s terms) reconciled: its note name is used,
      CONTEXT_COMPONENT_DROPPED (the component tree) and
      CONTEXT_EVIDENCE_DROPPED (the evidence quotes), each naming the
      quote, the span cited and the reason; its finding number (98) was
      already (98), work package 19, when the message arrived, so (99a)
      stays, the plan owner's to renumber; its (b) asks that "the fact's
      byte ranges then exclude the footer", which a component cannot do:
      a component is one half-open byte range and rule R1 (contract
      FACT_COMPONENTS/V2) requires its text to be those bytes, so a quote
      across a footer has the footer inside its range and its text, and
      every place the words are shown hides it (hidePageFooters: the
      tables, the tree, the sidebar, the clause). Splitting the component
      in two at the footer would make one word run two components; the
      manager decides if the range is to be cut another way. Counts from
      the preview branch's rows, generation 5 (run 51577c57): (a) 13 held
      facts have inherited components that resolve nowhere beside
      resolved own words (3.4's ten, 4.7's three), and the same three of
      4.7 at the evidence level (their two chapeau quotes are the only
      unmatched evidence on a context span in the run); on the next
      extraction the 4.7 quotes relocate (one Article IV chapeau span
      holds them) and 3.4's resolve by work package 13 (a), the drop the
      backstop for a quote no span holds. (b) Of the run's 5,439 resolved
      components, none spans a footer: 42 end mid-sentence at a footer
      and 27 begin right after one (4.14 six, 4.4 and 4.6 five each,
      4.5 four, 5.14 and 5.17 three each, 5.4 two, the Article IV
      introduction two, ten sections one), the model stopping its quote
      where the page ends; of the 13 held facts' unmatched quotes, none
      is a footer case. So the matcher changes no stored fact by itself
      and the extractor is now told, in the component instruction, that a
      page number on a line of its own between two words is a footer to
      quote across with the number left out, never to stop at; the
      matcher then takes the quote. (c) three facts (3.27 twice, 4.13
      once). (d) twelve facts (3.5(b) four, 3.7 four, 4.4(b) four). No
      decision of Ben's needed; nothing submitted, woken or retried. Two
      commits on the shared branch, "Work package 20: inherited
      components dropped not held, quotes across page footers, fused and
      exception-only representations" and "Work package 20 reconciled
      with the manager's message: note names, the extractor's footer
      line, the counts", after git fetch and merge of origin (B's (106)
      production-move files came in, no conflict); npm run test:active
      on the final tree: 778 of 779, the one failure the known
      Codex-client final-message test.
      (200) 2026-10-18 22:30 UTC to 2026-10-19 02:35 UTC (implementer A),
      work package 21: begun at the 22:29 check-in on (172)'s terms, then
      reconciled with the manager's message of 22:30 UTC, which reached
      this session at 02:13 (the worker restarted in between; the
      finding number (200) is the manager's). Read first: implementer
      E's ledger (lever 1, "components alone, short span aliases ... the
      compiler derives the evidence from the OWN components, maps aliases
      back, holds nothing for a role"; lever 7, anchored quotes, "the
      validator resolves"; the floor's "pair of byte offsets per
      component"), and the stored answers: 157 EXTRACTION calls, 4
      failures, the answer the response's text block, 4.69 MB of JSON
      for 1,066 proposals. Built in lib/product/agreement-draft.js and
      lib/product/fact-components.js only (a first cut had put an alias
      scheme and an alias field on the request's spans in
      source-context.js; reverted on the message: the request, the
      response contract and the prompt are E's). E's (181) and (182)
      landed on the branch during this package's push, with the lean
      request profile in the same file; merged by hand (the
      compileExtraction signature carries both rolesOptional and the
      alias expansion), E's tests passing. (b) The manager's alias
      table: response.span_aliases, a small integer to a 64-hex id (an
      object or a list of {alias, span_id}); expandSpanAliases replaces
      every integer alias in components, evidence quotes, links and
      cross-section links before any other rule runs; an integer alias
      the table lacks holds its component SPAN_ALIAS_UNKNOWN, never
      resolved through the section as an unknown id is. Also read
      directly, so the validator stands whichever request profile made
      the answer: implementer E's lean aliases s1..sn (E's (182), merged
      while this package was being pushed: E's normaliseLeanResponse maps
      them before the compiler, and resolveSpanReference reads them too;
      a first cut's own scheme, F and C1.., was dropped for E's) and a
      unique prefix of eight or more hex characters of the id.
      (a) Offsets are absolute, on the canonical text, because the
      request's spans carry absolute start_byte and end_byte, so a pair
      names one place in the document with no arithmetic against the
      span, and the same pair cited on two spans (a chapeau inside its
      section) is one place; a pair outside the text or reversed holds
      INVALID_OFFSETS, a pair outside the cited span OFFSETS_OUTSIDE_SPAN,
      a quote given beside offsets that are not its bytes
      OFFSETS_DISAGREE_WITH_QUOTE (a quote and agreeing offsets, or a
      quote alone, are accepted as today). E's quote_offsets of (182),
      the zero-based character offsets within the cited span's
      exact_text, are read as the absolute pair they name, so the one
      rule serves both forms (OFFSETS_SPAN_UNKNOWN when the span is not
      the closure's, since there is no text to count in); E's anchor
      names quote_from and quote_to are read as quote_start and
      quote_end. The bytes are the quote: the
      stored component keeps its shape, text and all, the position picks
      the occurrence, and every matching, relocation and footer rule runs
      as for a quote. With them, from E's lever 7, anchors: quote_start
      and quote_end, the shortest run of the cited span opening on the
      one and closing on the other, exactly one such run
      (ANCHORS_AMBIGUOUS with the count of runs unless an occurrence
      picks one; ANCHORS_NOT_FOUND), so the closing words must not occur
      earlier in the run; built because offsets are not a form a model
      writes by itself. A proposal without evidence_quotes takes its
      evidence from every component's words, own and inherited
      (evidence_derived: true; own words still decide exactOwned); the
      roles key left out is an empty set, and a required role missing
      holds nothing once the tree compiles (the rule since Metsera
      generation 7). The article, section and agreement references of
      work package 19 (c) are resolved again on the built tree, since an
      offset or anchor component has no quote before it resolves. (c)
      Proven on the stored rows, scripts/product/replay-answer-forms.js
      (inputs read from the preview branch's tables by SQL, listed in its
      header; nothing submitted, woken or written to a branch): every
      answered call (151) compiled as written, then rewritten to the
      short form with an alias table (every id in the answer an integer,
      the table beside it; no evidence_quotes; no roles) and compiled
      again, every proposal compared on status, statement, headline,
      components (kind, origin, text, bytes, value, children) and
      readout. By offsets: 1,063 of 1,066 identical; the three others
      are 4.7's facts, VALID both ways, which lose their Article IV
      introduction components under the offsets rule: the model cited
      those words on the Article III chapeau span, a quote is relocated
      to the span that holds it (work package 18 (a)) but offsets
      outside the cited span hold by the manager's rule, and work
      package 20 (a) then drops the inherited component with its note.
      By the shortest anchors that name the quote and nothing else
      (three to eight words): 1,066 of 1,066 identical, 3,892 of 4,102
      quoted components anchored, 210 (5 per cent) kept as quotes
      because no anchors of eight words or fewer name them alone. By
      anchors of a fixed count: three words leave 331 proposals
      different and four words 196, almost all ANCHORS_AMBIGUOUS on
      repeated openings ("the Parties have", "for each Share") or
      closing words that recur inside the run ("to be taken"), which the
      validator holds rather than guess; E's instruction for anchors
      must ask for the first and last words that name the passage alone
      in its span, or an occurrence. The 22 held facts are held the same
      way with the same issues in every form. On the manager's "the same
      1,015 VALID and 22 held": the run stored 1,037 proposals; the
      replay compiles every answered call, superseded attempts included,
      so it counts 1,066, and today's rules (work packages 13 to 20,
      which ran after the generation) give 1,044 VALID and 22 held on
      them by quotes; the equality that the proof can show, and shows,
      is between today's compile by quotes and today's compile by
      offsets or anchors; the stored statuses are the generation's, not
      reproducible without the rules of its day. The answer's JSON: 4.69
      MB as stored, 2.69 MB by offsets with the alias table (43 per cent
      less), 2.77 MB by anchors (41 per cent less), roles and
      evidence_quotes gone and the ids shortened in both. Two rules the
      replay forced: evidence derived from the own components alone made
      3.1's and 3.2's two qualification facts (the same heading words,
      different inherited exceptions) one occurrence and held both as
      duplicates, so the derived evidence takes every component's words,
      as the model's evidence_quotes did; and the structure references
      above. One consequence to know: a fact's occurrence id follows its
      evidence spans, so the same words answered under V9 and V10 carry
      different fact ids (as two V9 answers with different evidence
      quotes do); the facts compared are the words, bytes, headline and
      readout. Pinned: tests/product-fact-components-extraction.test.js
      (the table alias, deterministic alias and prefix, offsets with and
      without a quote, the three offset holds, anchors unique, ambiguous
      and absent, derived evidence, roles left out) and the stored 6.4
      call, tests/fixtures/product/ncs-generation-5-6-4-extraction-
      call.json (its bytes rebased to a window from the Article VI
      heading), the same three facts from the full answer and from both
      short forms with an alias table, no 64-hex id outside the table, no
      roles and no evidence_quotes left in it. Plan evidence: (172) and
      the message are built as named; the stored-status equality in
      (c) is not available as worded, for the reason above, and the
      proof is stated as what it is. The guide's agreement-draft entry
      carries the rules. One commit on the shared branch, "Work package
      21: the validator accepts span aliases, byte offsets and anchored
      quotes, evidence from the components and roles left out, proven on
      NCS generation 5's stored answers", after git fetch and merge of
      origin (E's (181) and (182) merged by hand, lib/product/agreement-
      draft.js); npm run test:active on the merged tree: 803 of 804, the
      one failure the known Codex-client final-message test.
      (201) 2026-10-19 03:30 UTC (implementer A), one correction to
      (176)'s reading of (200): the proof is not that "the stored NCS
      answers re-validate to the same 1,015 and 22". The stored statuses
      are the generation's (1,037 proposals, 1,015 VALID, 22 held, under
      the rules of 2026-10-18 13:27 to 20:47 UTC); today's compile of the
      151 answered calls gives 1,066 proposals, 1,044 VALID and 22 held
      by quotes, superseded attempts included and work packages 13 to 20
      applied. What (200) proves is that today's compile by quotes and
      today's compile by offsets (1,063 of 1,066, 4.7's three losing
      their introduction components under the offsets rule) or by unique
      anchors (1,066 of 1,066) are the same facts, the 22 held the same
      way with the same issues. Nothing else changed; no code in this
      finding.
      (202) 2026-10-19 08:45 to 09:15 UTC (implementer A), from E's
      (188) and the manager's (210), read against the canonical text
      (nothing assigned; no run touched): the Registration Statement fact
      the trimmed rung lost on 5.17 opens on "The Registration\n57\n
      Statement (or any prospectus or prospectus supplement ...), as
      initially filed" (canonical byte 228,113): an SEC page footer
      inside the first words of its ACTOR component. Under anchors the
      model names the first words without the number ("The Registration
      Statement (or"), as the component instruction tells it to for a
      quote, and work package 21's `anchorMatchesWithin` matched each
      anchor phrase byte for byte, so the anchor was never found and the
      component held ANCHORS_NOT_FOUND ("two unresolved anchors" on
      trimmed's 5.17 row), while the same words as a quote match under
      work package 20 (b)'s footer rule. That is a gap in my work package
      21, not in the trimmed context: (200) said every form resolves
      through the same footer rules, and the anchor phrases did not.
      Fixed in lib/product/agreement-draft.js: an anchor phrase is found
      verbatim or, when it has no verbatim occurrence in the span, with
      a footer line skipped between two of its words (`anchorPhraseMatches`,
      the same rule as `footerTolerantMatches`: the match must enclose a
      footer line, so whitespace alone never relaxes the verbatim rule);
      a run that holds a footer line, in an anchor or between the
      anchors, carries it as `page_footer_skipped`. Pinned in
      tests/product-fact-components-extraction.test.js with the 5.17
      words: the fact compiles VALID with the component's bytes running
      across the footer and its text the canonical bytes, and an anchor
      with two spaces in a run without a footer still holds
      ANCHORS_NOT_FOUND. Replay of the stored NCS generation 5 answers
      (scripts/product/replay-answer-forms.js, unique anchors with the
      alias table) is unchanged: 1,066 of 1,066 the same facts, 1,044
      VALID and 22 held, 2.77 MB against 4.69 MB; the stored quotes
      stopped at footers and crossed none, so no stored anchor crosses
      one, and the second ladder run is where this shows (trimmed's and
      direct_definitions' 5.17 rows should read 41 of 41 if the footer
      was the whole of the Registration Statement loss; the aggregate
      amount fact direct_definitions lost has no footer in its words,
      bytes 239,905 on, so its hold is of another kind, as (188) says,
      and the codes (188) now writes will name it). Whether the second
      run's anchors should be longer is the manager's call; this change
      makes the length irrelevant to a footer. npm run test:active on
      the commit: 838 tests, 837 pass, the one failure the known
      Codex-client final-message test.
      (203) 2026-10-19 15:40 to 16:30 UTC (implementer A), work package 22
      (the manager's message of 15:36 UTC and (216); the Sonnet 5.5
      confirmation on NCS generation 5, job pm-ablation-20261019T122404Z).
      The form, in one line: Sonnet writes an intra-definition clause
      number as a CROSS_REFERENCE ("clauses (1), (2), (3), (4) and (7)",
      "this clause (10)", "the exception in this clause (9)") with
      resolves_to null; Opus 5 wrote the very same words (3.1's and
      4.1's stored CROSS_REFERENCE components, product_fact_components
      of run 51577c57: "with respect to clauses (1), (2), (3), (4) and
      (7)", "clauses (1), (2), (3), (4) and (7)", "the exception in this
      clause (10)") and filled resolves_to itself with the section's own
      node (3.1's node 23091289 for the Company definition, 4.1's node
      23189d08 for Parent's; both definitions sit in those sections'
      own text) and the clause's words, so the resolver never had to;
      the code (`structureReferenceTarget`) took only "this Agreement",
      "this Article N" and "this Section X.Y", and a clause has no node
      of the structure to give (the manager's addendum of 15:41 UTC,
      read after the fix was written, pulls the same 4.1 rows and asks
      the same question; the answer below is the deterministic one it
      names, the model's own resolves_to kept). (1) and (2), the fix in
      lib/product/agreement-draft.js, `clauseReferenceTarget`: a
      CROSS_REFERENCE whose words are a clause reference (clause(s),
      paragraph(s), item(s) with "(n)" tokens and nothing but reference
      words) resolves from the text after the tree is built: the
      enumerators are looked for in the closure span that holds the
      referring component (the full section first, else the definition
      or context span it sits in), an occurrence inside the component's
      own words is never the clause (the reference names the same
      numbers), the occurrence nearest the component is the clause,
      its words run to the next enumerator of the list ("(6) ..." ends
      where "(7)" begins; digits, roman numerals and letters) or 400
      characters, and resolves_to is that span's structure node with the
      clauses' words joined by " | " (the page shows what the carve-back
      reaches). A plain "Section 2.1(a)" (8.3's Opus form, "Section
      2.1(a)" with resolves_to the 2.1 node) now resolves to its section
      node as "this Section 2.1" did; a sub-clause suffix is allowed.
      The model's own resolves_to still stands, so the stored Opus 5
      answers compile as before: the replay of (200) and (202)
      (scripts/product/replay-answer-forms.js, unique anchors, the alias
      table) is unchanged at 1,066 of 1,066 the same facts, 1,044 VALID
      and 22 held. A clause the text does not have ("clauses (1) and
      (9)" where there is no (9)) stays unresolved and the fact held, as
      a defect should. The component instruction (V7, inherited by V10)
      gains one sentence: for a reference to a numbered clause of this
      section or of a definition, quote the reference words and the
      code resolves the clauses, so resolves_to may be left out. Not
      read: the 5.10 (7c7a8854) and 8.3 (a7864ed9) Sonnet components,
      which the held-proposals file does not carry (it has the 3.1, 4.1,
      3.2, 5.16, 3.18 and 4.10 ones); 5.10's stored Opus facts have no
      CROSS_REFERENCE at all, so Sonnet's is a new reference whose words
      I cannot see: manager, please add those two proposals to the file
      and I read them against the rule. (3) The four empty-quote holds
      are the model's, not the normaliser's: the three LISTs (5.16
      c4a47fcf, 3.18 f8ce9086 and f469dcaf) were written with every
      LIST_ELEMENT resolved to bytes and no words at all on the LIST
      (text "", no bytes; a LIST with anchors that failed would carry
      "from … to" as its text, and this carries nothing, so the model
      gave the container neither a quote nor anchors). Fixed by rule,
      since a list is its elements: a LIST with no words of its own and
      every LIST_ELEMENT resolved in order takes the canonical bytes
      from the first element to the last as its words
      (fact-components.js `buildComponentTree`, through the same offsets
      resolution as work package 21, so the words lie in the cited span
      or the fact is held as before) and the proposal carries a
      LIST_WORDS_FROM_ELEMENTS note naming the path and the count; the
      instruction says a LIST quotes the words from its first element
      to its last. 4.10 c9e13474 is the model's words and stays held:
      its STANDARD "would reasonably be expected" is not in 4.10, whose
      words are "would not reasonably be expected to have a Parent
      Material Adverse Effect"; a quote that drops the "not" must not be
      relaxed into the text. (4) The four REPRESENTATION_QUALIFICATION
      facts (3.1 7e52a514, d2d7451e; 3.2 01397aaa, 84bec2d1): the stored
      Opus 5 statements are the Disclosure Letter and SEC Documents
      qualifiers written once per section ("The Company's
      representations and warranties to Parent and Merger Sub, including
      those in Section 3.1 ..., are given except as set forth in the
      disclosure letter ..."; the same pair on 3.2 without the section
      named). Whether Sonnet carried them under another subtype on 3.2
      I cannot say from here: 3.2's three new facts are not in the
      held-proposals file; manager, please add them (or the 3.2 rows of
      analysis/anchors_sonnet55.analysis.json) and I read them. The rule
      as written (REPRESENTATIONS layer rule: "it is one
      REPRESENTATION_QUALIFICATION fact per source of exception") names
      the fact but not the section it belongs to, and Opus answered it
      on every section (two facts on 3.1, the same two on 3.2), Sonnet
      on none. Proposal, not a change: add to the layer rule "write the
      two qualification facts on every section of the article whose
      closure carries the introduction (origin INTRO), one per source
      of exception, with the section's own representation facts; they
      are not components only" if Ben wants them per section as Opus
      wrote them, or "... on the article introduction's own node once"
      if once per article; the legal content is the same either way and
      the choice is the page's (one row per section or one per
      article), so Ben's. Tests:
      tests/product-fact-components-extraction.test.js (the clause form
      on a definition with seven carve-outs: the carve-back's four
      clauses resolved to the section with their words, "this clause
      (6)" to clause (6) ending before (7), Opus's given resolves_to
      kept, "(9)" absent held; "Section 2.1(a)" to the 2.1 node of a
      built structure; the wordless LIST VALID with the four elements'
      bytes and the note). npm run test:active on the commit: 850 tests,
      849 pass, the one failure the known Codex-client final-message
      test.
      Second addendum (the manager's message of 16:05 UTC and (217): the
      variance job shows Sonnet's resolves_to omission varies run to
      run, 4.1 whole one run and 3.1 six holds the next, and Opus 5.5
      medium one hold, so the deterministic resolution above is the fix
      across tiers; and the four qualification facts and 2.3's Exchange
      Fund sentence are omitted on every cheaper-tier run, a contract
      instruction matter): the extraction request now names those facts
      per routed family (`FAMILY_FACT_REMINDERS`, appended to the
      component instruction after the layer rules, V7 and V10 alike).
      REPRESENTATIONS: where the article introduction qualifies the
      representations, return one REPRESENTATION_QUALIFICATION proposal
      per source of exception as a fact of this section, its components
      the introduction's words with origin INTRO (the source, its
      window, its exclusions as a LIST), besides inheriting the qualifier
      into each representation's tree; an extraction that inherits the
      introduction and returns no qualification fact is incomplete.
      CONSIDERATION: the sentence that constitutes the exchange fund (the
      deposit with the Exchange Agent, "(the “Exchange Fund”)") is an
      EXCHANGE_MECHANICS fact of its own, as each later rule on the
      fund's use, investment, return and termination is (the stored Opus
      5 wrote 2.3's six fund facts under EXCHANGE_MECHANICS). The layer
      rule is unchanged; the instruction says per section, as Opus 5
      answered the rule; whether Ben wants the two qualification facts
      once per article instead is the question above. Pinned:
      tests/product-fact-components-extraction.test.js (the request for
      a representations section routed to REPRESENTATIONS and
      CONSIDERATION carries both sentences; the merger section routed to
      the merger family carries neither). npm run test:active on the
      second commit: 851 tests, 850 pass, the one failure the known
      Codex-client final-message test.
      (204) 2026-10-19 16:15 to 16:40 UTC (implementer A), the two
      references of work package 22 the held-proposals file now carries
      (the manager's ce7f226 and message of 16:23 UTC) and 3.2's new
      facts. 8.3 a7864ed9: Sonnet cut "For purposes of this Agreement"
      as a CROSS_REFERENCE (Opus 5 had cut "Section 2.1(a)" instead);
      5.10 7c7a8854: "set forth in Article VI". The second is a plain
      Article reference with the words that introduce it; the first is
      a framing phrase around a reference to the agreement as a whole.
      Both were read by the resolver as no reference at all. The
      manager's question on the framing phrase, which of "not a
      CROSS_REFERENCE" (the instruction) or "held as now": neither
      alone. The fact is the Permitted Liens definition and a framing
      phrase is no reason to hold it, and an instruction the cheaper
      tier follows one run and not the next (the variance of (217))
      cannot be the only guard; so the code resolves "this Agreement"
      inside such a phrase to the agreement's root node, as work
      package 19 (c) resolves the bare "this Agreement", and the
      instruction tells the model the phrase is not a CROSS_REFERENCE
      ("a framing phrase that names no provision ('For purposes of this
      Agreement', 'hereof', 'as used herein') is not a CROSS_REFERENCE,
      leave it in the words of the component it opens"), both pinned. A
      framing phrase that names nothing at all ("as used herein" is
      already SELF_REFERENCE, needing no node) stays as before. The introducing words ("set
      forth in", "pursuant to", "for purposes of", "under", "in
      accordance with" and the like; `REFERENCE_LEAD`) are now stripped
      before the article, section and agreement forms are read, and
      "Article VI" resolves without "this" as "Section 2.1(a)" does; a
      section or article the agreement lacks stays unresolved. 3.2's
      three new Sonnet facts are CAPITALISATION facts (no preferred stock
      outstanding at the Company Measurement Time; reserved shares
      validly issued when issued; the equity award inventory), none a
      qualifier: Sonnet did not carry the Disclosure Letter and SEC
      Documents qualifiers under another subtype, so the per-family
      instruction above is the answer, and whether the two facts belong
      on every section or once on the article introduction stays Ben's
      question. Pinned in tests/product-fact-components-extraction.test.js
      ("set forth in Article II" to the article node, "pursuant to
      Section 2.1(a)" to the section, "For purposes of this Agreement"
      to the root, "Section 9.9" absent unresolved; the instruction
      sentence in the request). The stored-answer replay is unchanged
      (1,066 of 1,066; 1,044 VALID, 22 held). One test change outside
      the package: tests/product-fresh-sheet-experiments.test.js pinned
      the order of `result.model_calls`, which the section result sorts
      by model_call_id, a content hash of the request, so the new
      instruction sentence reordered a routing or residual call behind
      the extraction call; the three assertions now read the calls by
      kind (the `seen` order, the real call order, was pinned already
      and is unchanged). npm run test:active on the commit: 851 tests,
      850 pass, the one failure the known Codex-client final-message
      test. Pushed 2026-10-19 16:57 UTC as 1f2cae8 (merge 5d34ed9), an
      ancestor of 4c4e918c and 381c7592; re-read on 2026-10-21 22:30
      UTC at the manager's third ask ((220) and the messages of 20:58
      and 22:26 UTC): the code, the four pinned assertions and this
      finding are all in the head, the extraction test file passes 30
      of 30 there, nothing to redo.
      (205) 2026-10-22 06:35 to 07:05 UTC (implementer A), work package
      23 (the manager's message of 06:31 UTC): the guard's check (job
      pm-ablation-20261022T053736Z, the plain Sonnet rung on a sandbox
      carrying (203)) held nine of 4.1's twenty facts and one of 3.1's;
      the components as Sonnet wrote them are in
      docs/codex-program/notes/sonnet-confirmation/sonnet-held-proposals-ncs5.json
      under held_after_203. The form, read against clauseReferenceTarget:
      all seven 4.1 cross-references are one text, the clause numbers
      alone, "(1), (2), (3), (4) and (7)", the word "clauses" left in the
      component before them ("with respect to clauses" cut as a
      QUALIFIER); Opus 5 wrote "with respect to clauses (1), (2), (3),
      (4) and (7)" or "clauses (1), ...". (203)'s rule required a clause
      word; a reference that is nothing but enumerators and their
      connectors (`BARE_ENUMERATOR_LIST`) is now the clause form too and
      resolves from the section's enumerated items as before, the
      model's own resolves_to still kept when given. The two LISTs:
      "business, assets, liabilities, condition (financial or otherwise)
      or results of operations" (3.1; 4.1 with "of Parent and its
      Subsidiaries"), written with words and no LIST_ELEMENT children,
      where Opus 5 wrote five elements (four once, "assets, liabilities"
      together). Decision: derive, not hold. The elements are cut from
      the list's own resolved words (`listElementRanges` in
      lib/product/fact-components.js), deterministically: at its
      enumerators when it has two or more, else at its semicolons, else
      at its commas, the last comma piece split once at its first
      depth-zero "or" or "and" ("A, B, C or D"), a parenthesis kept
      whole, a leading "and" or "or" dropped as the series' conjunction;
      each element a LIST_ELEMENT on the span the list cited, at its
      words' bytes, labelled by its words; the fact VALID with the note
      LIST_ELEMENTS_FROM_WORDS {path, elements, split}. Words with no
      series (no enumerator, semicolon or comma; "A or B" too, since a
      bare conjunction would split "results of operations of Parent and
      its Subsidiaries") stay a LIST without elements and the fact held
      as before. Why derive: the fact is the MAE prong and its words are
      the agreement's, verbatim and resolved; the cut reproduces Opus
      5's five elements on both sections; and the rule is the inverse of
      (203)'s wordless-LIST rule and as deterministic, so a model that
      writes either half of a list gets the whole. The component
      instruction names both forms (the bare numbers; the elements cut
      by the code from a LIST with a quote and no children). Pinned in
      tests/product-fact-components-extraction.test.js on the exact
      texts: "(1), (2), (3), (4) and (7)" resolving to the five clauses,
      the comma LIST to five elements in order inside the list's bytes
      with no relocation, an enumerated LIST to three, "the business"
      held; the instruction sentences in the request. On the real rows:
      the eight held proposals rebuilt as answers from their stored
      components and compiled against the NCS canonical text all come
      out VALID, the 4.1 reference resolving to (1) to (4) and (7) with
      (7) ending at (8), the two LISTs to five elements each. The
      stored-answer replay is unchanged (1,066 of 1,066; 1,044 VALID, 22
      held). npm run test:active on the commit: 860 tests, 859 pass, the
      one failure the known Codex-client final-message test.
      (206) 2026-10-22 08:35 to 08:50 UTC (implementer A), work package
      24 (the manager's message of 08:33 UTC): the article introductions
      held whole on the second eight-section check (III-INTRO 0 of 3,
      IV-INTRO 0 of 2, every fact DUPLICATE_FACT_OCCURRENCE; (225)),
      read against the rule, no rule change. The rule
      (lib/product/agreement-draft.js, compileExtraction): the
      occurrence key PRODUCT_FACT_OCCURRENCE/V1 is {source_document_id,
      family_key, subtype_key, fact_type, source_span_ids}, where
      source_span_ids are the fact's evidence spans, each a
      PRODUCT_SOURCE_SPAN/V1 content id of the document and the matched
      bytes; under the V10 lean format (no evidence_quotes) they are the
      spans of the fact's own top-level OWN components
      (ownWordsAsEvidence). The key names no node and no actor, and the
      check runs over one extraction answer at a time (the `temporary`
      list of one compileExtraction call), so a fact of the
      introduction node can never collide with a fact of a section:
      the sections' qualification facts and the introduction's are
      compiled in different calls and kept apart by proposal_id, which
      carries structure_node_id; the draft assembly dedupes by
      proposal_id only. Which wins: none. Candidates sharing a key are
      re-keyed (PRODUCT_COLLIDED_FACT_OCCURRENCE/V1); when their
      component footprints (every OWN component's byte range, children
      included) are all distinct they all stay VALID (the 3.13 limbs
      rule, Metsera generation 5); when any two are identical every
      candidate in the set is held, the distinct ones too. So "0 of 3"
      means the introduction's own answer carried two or more facts
      whose own words were byte-identical, and the third was held as a
      member of the same set (or duplicated as well). The stored
      generation shows the shape: III-INTRO's three facts and IV-INTRO's
      two are all REPRESENTATION_QUALIFICATION /
      REPRESENTATION_ACCURACY_STANDARD, one family, subtype and fact
      type, so the key reduces to the bytes of their own words and any
      two written on the same words collide. Why this run and not the
      one before: the request was the same on both (the per-family
      reminder of a8656b3c, 2026-10-19, is appended to every request
      whose routing has REPRESENTATIONS, the introduction node's
      included, and the article_introduction_instruction of 2026-09-14
      is on the introduction node too); on the introduction node the
      two ask for the same facts in two voices ("one per source of
      exception the introduction states" and "one
      REPRESENTATION_QUALIFICATION proposal per source of exception as
      a fact of this section ... besides inheriting the qualifier into
      each representation's tree"), and a model that answers each
      sentence once writes each qualification twice; which run Sonnet
      collapses the two asks is its run-to-run variance (the same
      variance as 5.1's part 1 in (225)). The check's rows are on the
      sandbox and would name the duplicated pair; the mechanism above
      is the only one the rule allows. The two placements and their
      consequences, for Ben ((218)): per section, each representation
      section carries the two qualification facts as its own (the
      stored generation already does on 3.1 and 3.2, two each, Opus 5
      writing them without the reminder; the reminder makes Sonnet do
      the same), the introduction node then carries none, so its
      request must say so (the article_introduction_instruction turned
      round: the introduction's qualifications are facts of the
      sections that inherit them, the introduction returns no
      proposal) and the page's General Exceptions row is built from
      the sections' facts instead of the introduction's
      (intro_facts_row in lib/product/table-view.js reads only -INTRO
      facts today); the alternative the manager names, the duplicate
      rule treating the introduction's as the originals and the
      sections' as inherited, needs a new cross-node rule (none exists)
      keyed on the INTRO-origin bytes, and the page then shows one
      General Exceptions row per article and no per-section copies.
      Once per article, the per-section reminder goes from the request
      and a REPRESENTATION_QUALIFICATION fact from a non-introduction
      node whose components are all inherited (origin INTRO) is held
      or dropped in code, since Opus 5 wrote such facts unprompted;
      the sections keep the qualifier inside each representation's
      tree, the introduction node keeps its two or three facts and the
      General Exceptions row as now, and the duplicate holds of this
      run end because the introduction's request asks once. Either
      way the introduction's own answer must be asked for once, not
      twice; nothing changed until Ben answers.
      (207) 2026-10-22 09:12 to 09:35 UTC (implementer A), work package
      25 (the manager's message of 09:11 UTC, from (206)): one voice on
      the introduction node. The request builder knows the node where
      the reminder is appended (buildAgreementSectionDraft builds
      component_instruction with `node` in scope, and
      isArticleIntroduction(node) is the test the
      article_introduction_instruction itself uses), so no other signal
      was needed: familyFactReminders(routing.families, {
      articleIntroduction }) leaves the REPRESENTATIONS reminder out on
      an article introduction node and keeps every other family's; a
      representation section keeps the reminder as it was (its
      qualification facts are the ones the cheaper tier omits, (217)).
      The duplicate rule is untouched. Pinned in
      tests/product-fact-components-extraction.test.js on requests built
      through buildAgreementSectionDraft: the 3.01 request carries the
      reminder and no article_introduction_instruction; the III-INTRO
      request carries the article_introduction_instruction, no
      REPRESENTATIONS reminder, and the CONSIDERATION reminder still.
      The stored-answer replay is a compile-side check and does not
      read the request, so it is unaffected. One more voice remains on
      one rung only, for the manager: E's INTRODUCTION_COUNT_INSTRUCTION
      ((199c), the counts_sonnet55 profile, introduction_counts) tells
      the introduction node again to return one REPRESENTATION_
      QUALIFICATION proposal per source of exception; it is E's field,
      the plain default does not carry it, and it is left as it is. npm
      run test:active on the commit: 863 tests, 862 pass, the one failure
      the known Codex-client final-message test.
      (208) 2026-10-22 17:10 to 18:05 UTC (implementer A), work package
      26 (the manager's message of 17:09 UTC; Ben's three answers in
      (232), verbatim: "Yep, don't think you even need to say parent
      consent as that is up too in intro no?"; "A on dividend point";
      "Option a on placement"). (1) The extractor's instruction
      (lib/product/agreement-draft.js, the same text on every section of
      every deal) carries one sentence per shape: a list of objects
      under one operative verb inside one lettered or numbered limb is
      one proposal, its objects one LIST with one LIST_ELEMENT per
      object, never one proposal per object, separate limbs separate
      proposals; a proviso that only carves out from its covenant is an
      EXCEPTION component of that covenant's proposal and not a
      proposal, a proviso that creates an obligation or right of its own
      a proposal, linked to the covenant it follows; the opening words'
      consent standard, time window and sources of exception are the
      opening words' own proposals, stated once, and a limb's proposal
      states its own action and cites the governing opening words as
      inherited evidence (an evidence quote, a CHAPEAU or INTRO
      component) without restating them in its statement. The third
      replaces "Repeat a parent or chapeau qualification in each affected
      proposal when needed"; the scope_instruction says the same after
      its citation sentence ("Those opening words are the limb's
      evidence, not its statement"); the two part instructions say "cite
      the chapeau words that qualify a limb as that limb's inherited
      evidence, not in its statement" where they said "repeat". Under
      the lean default the statement is already the OWN components'
      words ((190)), so the third shape binds the code on that path and
      the model's own statement elsewhere. Nothing in the normaliser or
      the validators holds the shapes, checked on NCS 5.1's own words
      (tests/fixtures/product/conduct-of-business-ncs-words.js: limb
      (a)'s lead, (a)(xi), limb (b)'s lead, (b)(i), (b)(ii), cut from the
      stored generation 5 text; the synthetic layout fixture of (199e)
      stays beside it): the Tax covenant as an ACTOR and a CONDITION of
      origin CHAPEAU on the lead plus one OWN LIST with no children
      compiles VALID with five LIST_ELEMENTs cut at the semicolons
      (LIST_ELEMENTS_FROM_WORDS, SEMICOLONS, (205)'s cutter) and a
      statement that is the limb's words alone; the dividends
      restriction with "provided that Parent may make (A) ... and (B)
      ..." as an EXCEPTION component compiles VALID, no
      REPRESENTATION_EXCEPTION_NOT_A_FACT (the work package 20 (d) rule
      reads representations only) and no fused-limb note; the lead's
      consent standard, time window and sources of exception compile as
      three VALID facts citing the lead alone, and the Tax limb's fact
      cites the very consent words the standard's fact states (the
      evidence spans are one per quote, so the two share an id); two
      limbs under one lead keep occurrences of their own. No code change
      was needed below the instruction. (2) Placement: (207) stands, no
      extraction change. lib/product/table-view.js articleQualifications
      (its party rule the General Exceptions row's, now
      articleIntroductionParties) hands each representation table its
      article's valid REPRESENTATION_QUALIFICATION facts from the
      introduction node as article_qualifications (fact, article, the
      fact's statement, or its OWN words when none), and
      components/product/ProvisionTables.jsx renders them above that
      table in the page's quiet style ("Article III introduction,
      qualifying every representation below: " then the words, which
      open the fact in the sidebar), nothing when the article has none;
      the General Exceptions row keeps its coded reading. Built in the
      table view rather than in provisions-preview.js, so every page
      that renders the tables shows the lines (the lawyer preview under
      /review/product/[id]/provisions, the page (232) names; the query
      page) and the preview module stays the read-only join it is.
      Pinned in tests/product-provisions-preview.test.js on NCS's
      III-INTRO and IV-INTRO words: one block per representation table,
      before the table and under its own section heading, the parent's
      introduction on the parent table, a held or STATUS_REPRESENTATION
      introduction fact not shown, no block without an introduction.
      (3) This finding; docs/core/CODEBASE-GUIDE.md. Against the stored
      Opus run, which repeats the qualifiers per section and splits the
      Tax covenant, the new rules read as (232) says: two unmatched per
      representation section and one bundled Tax fact, expected, not
      losses. npm run test:active on the commit: 872 tests, 871 pass, the one failure
      the known Codex-client final-message test.
      (120) 2026-10-18 19:10 to 19:45 UTC (implementer C), Q5: the limb
      names harvested. `scripts/product/harvest-rep-limbs.js` (library
      `lib/product/rep-limb-harvest.js`, `tests/product-rep-limb-harvest.test.js`)
      reads every readout on the two representations tables across the
      runs it is given (`--run <id>` from the database or `--snapshot
      <file>`, finding (124)), clusters the row_detail values per
      representation row by the words they share (stop words, the
      parties and materiality dropped, a small stemmer, a "Scope: rest"
      prefix such as "Subsidiaries:" or "Non-U.S. Benefit Plans:" kept
      as a scope, the row's own common words left out on rows of ten or
      more names, two names one run gave to one section never folded,
      likeness 0.6) and proposes one canonical name per cluster: an
      existing detail_labels_by_row label when the cluster holds one,
      else the most used member. Ben decides the names; nothing in
      table-shapes.v3.json changed. The note for his decision:
      docs/codex-program/notes/Q5-REPRESENTATION-LIMB-NAMES-PROPOSAL-2026-10-18.md
      (858 lines, one table per representation with the counts, the
      names folded and one example per name), rerun as one command when
      Olaplex and Apogee finish. Read from Metsera generation 8 and NCS
      generation 5 (NCS generation 4 is bundle V8 and carries no
      readouts, so it adds nothing): 558 readouts, 528 with a limb name,
      489 distinct names, 21 used in more than one run, 446 proposed
      names of which 43 fold several. What the harvest shows, which is
      the premise of Q5 proved on the data: on the nine rows that have a
      canonical list (decision 31's Organization and Authority, General
      Exceptions, Knowledge, Capitalization, Material Contracts and the
      Parent twins) 64 of 78 limb facts carry a canonical name, and
      Organization, Authority and General Exceptions carry one on every
      fact in both deals; on the 43 rows without a list the extractor
      named 450 facts with 442 distinct names, 8 of them used in both
      deals, so nothing on those rows compares across deals until Ben
      fixes the vocabulary. The clustering was read against the output
      three times (Ben: "look at all of the output yourself and analyze
      if you think it is right or wrong and if not, iterate to improve
      it"): the first pass folded "Securities law filings exception"
      with the HSR Act exception and two post-Closing income limbs of
      one section, fixed by the likeness, the same-section rule and the
      scope prefix; every one of the 43 folds in the committed note was
      then read and holds (the Taxes, ERISA and Labor pairs are the
      same limb in NCS words and Metsera words). What it cannot do: the
      403 single-name clusters on the unseeded rows are the extractor's
      one-off wording, a limb list has to be decided, not clustered,
      and the note gives Ben the material per row to decide from.
      (121) 2026-10-18 19:45 UTC (implementer C), Q4: the evidence note
      docs/codex-program/notes/Q4-LEGACY-QUERY-COMPARE-EVIDENCE-2026-10-18.md,
      no code changed. Read from the code at 3ab0989 (a survey agent's
      inventory, its main claims checked line by line): legacy Query is
      already off at every entry point (the five `/api/query/*` routes
      answer 503 ROUTE_CONTAINED, every `/query/*` page but
      `/query/provisions` redirects to `/`, the home page hides the
      query surface behind QUERY_UI_CONTAINED) and its archived handlers
      read the legacy `deals`, `provisions`, `provision_cards`,
      `saved_queries` and `users` tables through the
      `ai_metadata.features` field model, never a product table;
      Compare is two extra columns on the legacy review page behind
      `?compare=` and `?market=1`, reachable only by typing the URL,
      with its market stats contained; the layered read
      (`listPublishedLayeredFacts`) serves activated releases only, and
      the preview branch holds none (zero release heads, zero releases
      on 2026-10-18), so it answers an empty list until Phase 6 loads
      one. The cost table: retire now is one deletion commit (about
      36,000 lines, 18,170 of them the alias registry, and 80 test files
      outside test:active); keep unrouted costs nothing now and keeps
      ageing; migrate is a rewrite, not a port, because the V2 facts do
      not carry the fields the kinds filter on. Put to Ben as one line:
      retire now or keep unrouted, and whether a Query on layered facts
      (a conclusions-cell filter across agreements) becomes a plan item
      once releases exist.
      (122) 2026-10-18 19:20 to 19:45 UTC (implementer C), Phase 5
      reconciliation dry run. One command now exports a run's V2 facts
      and reconciles Ben's notes against them:
      `node scripts/product/reconcile-ben-samples.js --notes olaplex|apogee
      --run <id> --out-dir <dir>` (`--snapshot <file>` in place of
      `--run`), writing v2-facts.json, reconciliation.md and summary.txt;
      it refuses a V1 run (no component trees) and a run of another
      agreement when the notes name their source URL (Apogee's do;
      `--allow-source-mismatch` for a path check), and
      `scripts/product/reconcile-sample-notes.js` now exports its report
      renderer and runs only as a script. Run against Metsera generation
      8 (the only READY V2 run; Olaplex has V1 runs 068d9468 and
      9cb8e881, Apogee V1 run a21f9bf7, both refused as V1 by the
      command) with both note files as a path check, not a measure, and
      three defects in the tooling found and fixed with tests
      (`tests/product-sample-reconciliation.test.js`,
      `tests/product-reconcile-ben-samples.test.js`): (a) the article
      introduction: the structure builder names the node "III-INTRO"
      (every run's closures carry "III-INTRO" and "IV-INTRO") and the
      matcher accepted "III", "3" and "3.0", so Apogee's "Article III
      intro" note would have matched nothing; (b) section numbering: a
      note says "6.1(a)" and Metsera's sections are "6.01", so every
      Olaplex item was MISSING with no candidate until leading zeros are
      dropped on both sides (as source-context's normalizedReference
      does; "6.10" stays section ten); (c) the fact's reference is its
      section node's ("6.01"), never a subsection, so a note on
      "6.1(a)-(d)" must reach the facts filed under "6.1", which the
      self-or-descendant rule never did; the fact's section may now be
      the note's own, below it or above it (an article number alone
      never matches). After the three: Olaplex 72 items against Metsera
      3 MATCHED, 24 PARTIAL, 44 MISSING, 1 GAP, 29 items whose section
      Metsera lacks; Apogee 7 items 0, 4, 3, 0 and 2 (meaningless as a
      measure, the agreements differ; the path runs end to end). What
      the measure will say once Olaplex and Apogee are READY under V2:
      per note item, the best fact in its section by word overlap with a
      status at 50 and 20 per cent, the facts in noted sections no item
      mentions, and the counts; Ben fills severity and acceptance.
      What it will not say: a success rate (the report prints
      "unavailable until the lawyer marks severity"), whole-agreement
      recall (the notes are partial by their own provenance fields),
      citation sufficiency or narrowness (the matcher reads headline and
      component words, not spans), duplicates or contradictions (not
      scored), or review time (not recorded). A MATCHED status is a
      word-overlap guess for Ben to confirm, never acceptance. The
      database path of the command (`ProductPhase3Store#getAgreementAnalysis`,
      as export-review-comparison-inputs.js uses it) ran only through
      the test's fake store in this session, because the branch's keys
      are not in this environment (finding (124)).
      (123) 2026-10-18 19:30 to 19:45 UTC (implementer C), finding
      (66)'s open item: the 51 REQUIRED_FACT_TYPE_UNRESOLVED draft
      issues on Metsera generation 8. `scripts/product/unresolved-fact-types.js`
      (library `lib/product/unresolved-fact-types.js`,
      `tests/product-unresolved-fact-types.test.js`) reads each one back
      to the sections whose FACT_TYPE assertion is UNRESOLVED and the
      cause the stored rows hold (a SOURCE_CLOSURE_INCOMPLETE issue, a
      held proposal of the type, or the model's own coverage answer
      parsed from the extraction call against its facts), says whether
      another section carries the type VALID, and gives a verdict per
      fact type; `--compare` sets a second run's list beside it. The
      note: docs/codex-program/notes/METSERA-GENERATION-8-UNRESOLVED-FACT-TYPES-2026-10-18.md.
      The reading corrects the item's premise. The 51 are not sections
      answering NOT_FOUND where another section carries the fact: all
      51 come from one section, Exhibit-B, the Form CVR Agreement,
      routed to 13 families (nine by the router, four widened from the
      residual pass) and never extracted, because its closure records
      six unresolved references (2.4, 2.4(a), 2.4(e), 2.4(i), 2.6, 5.3:
      the CVR Agreement's own sections, which are inside the one exhibit
      node and have no node of their own) and seventeen more resolved
      into the main agreement by number ("2.2" to the merger agreement's
      2.02), and the closureIncomplete branch of agreement-draft.js
      writes UNRESOLVED for every required fact type of every routed
      family and makes no extraction call. 47 of the 51 fact types are
      carried VALID elsewhere in the run and 4 are not
      (ORDINARY_COURSE_DEFINITION_RECORDED, INTENDED_TAX_TREATMENT_KIND,
      TAX_OPINION_COOPERATION_COVENANT, TAX_TREATMENT_PROTECTION_COVENANT:
      a cash deal with no tax-treatment covenant, absent as such).
      Generation 7 has the same 51 plus NO_SHOP/SUBSEQUENT_MATCH_PERIOD
      (5.02's held facts, since fixed). So the state is two things at
      once: bookkeeping in the draft issue, which names the fact type
      and not the section or the cause, so "TERMINATION_RIGHT
      UNRESOLVED" stands beside sixteen valid termination rights; and a
      real gap in the draft, the CVR Agreement itself, whose nine
      unusual-provision flags from the residual pass (the $1.5bn
      development spend commitment, the Change of Control assumption,
      the anti-avoidance covenant, the abandonment right) are the only
      trace of its content in the run. NCS shows the other causes the
      script tells apart (generation 4: 23 draft issues, 14 held facts
      the lawyer decides, 3 model answers against the model's own
      facts, 5 FOUND-with-nothing with no valid fact anywhere;
      generation 5 so far: 2, both held). Proposed, for the manager and
      implementer A (extraction defects are A's track), not built here:
      (i) the draft issue carries the sections and causes it is made of
      (the message naming `Exhibit-B: SOURCE_CLOSURE_INCOMPLETE` beside
      the fact type), the state staying UNRESOLVED as OPERATING-RULES
      requires; (ii) a reference from an exhibit scope that has no
      target in that scope is the exhibit's own internal reference (its
      text is already in the closure as the full section span) and
      neither unresolved nor a cross-scope match into the main agreement
      by bare number, so the CVR Agreement's closure is complete and it
      is extracted like any section (it would then split as a long
      section, which Q6 and work packages 9 and 15 already handle);
      (iii) until (ii) lands, an incomplete closure should still be
      extracted with the incompleteness recorded as the issue it already
      is, rather than skipped, because a skipped section is absence
      presented as UNRESOLVED bookkeeping. Whether the CVR Agreement's
      terms belong in the Metsera draft at all is Ben's call; the
      router and residual pass both said they do.
      (124) 2026-10-18 (implementer C), how the runs were read.
      `lib/product/run-rows.js` (`tests/product-run-rows.test.js`) is
      the one loader the three scripts share: a run's rows per table
      from the database through supabase-js, paged in the store's order
      with equality filters, or the same rows from a snapshot file
      (`PRODUCT_RUN_SNAPSHOT/V1`: `{ run_id, tables: { <table>: rows } }`),
      so a script's reading of a snapshot is its reading of the
      database (Ben: "everything to be driven by coding and not just a
      layer on top so all edits need to be repeatable across corpus").
      This session's environment holds the production project's keys,
      which the preview branch ecrtoofsyxozazkvsvcl refuses ("Invalid
      API key") and the production project itself now answers with
      "Legacy API keys are disabled", and no key was decrypted or
      written down; the rows
      were read as plain SQL through the Supabase connector, saved
      outside the repository and assembled into snapshots of the same
      row shape (Metsera generations 7 and 8, NCS generations 4 and 5,
      the generation 8 proposals in ten pages of a hundred with their
      components, headlines and statements; the model calls of the
      unresolved sections as their two coverage objects). The snapshots
      are not committed (the generation 8 one is 4 MB); the notes say
      which runs they came from and every figure above reruns from
      `--run` with the branch's keys. The four test files are in
      test:active: 729 of 730, the one failure the known Codex-client
      final-message test. Not done, deliberately: no run, worker or sandbox was
      touched; the preview API was not called; detail_labels_by_row,
      the closure builder and the draft's issue message are unchanged,
      proposed only.
      (105) 2026-10-18 21:15 to 22:40 UTC (implementer B), work package
      B2 on the manager's message of 21:10 UTC: NCS generation 5 (run
      51577c57) read READY by SQL at 21:15 (READY since 20:47, 104 of
      104 sections, 1,037 proposals; nothing woken, retried or touched)
      and the comparison regenerated with it as the V2 side, the
      inputs assembled from the preview branch's tables as (101) did
      (headline summaries from product_fact_headlines joined on). The
      note docs/codex-program/notes/NCS-V1-V2-GENERATION-COMPARISON-
      2026-10-18.md now opens with the reading and keeps the script's
      report after it. Counts, generation 4 then 5: V2 valid 850 then
      1,015; held 145 then 22; V1 facts with a counterpart 649 then
      689, partial 231 then 281, without 102 then 12 (11 of the 12
      overlap a fact V2 held); new to V2 32 then 90 (49 KEY_DEFINED_
      TERMS, 42 of them the definitions section 8.3, and 38
      REPRESENTATIONS in sections V1 routed IMMATERIAL); every section
      routed (104 of 104, V1 95). The by-table part is real: 29 table
      sections, every V2 valid fact on a row or in a table's Other
      provisions but nine without a readout (three intervening-event,
      four conditions, one fee, one boilerplate); the only V1 facts a
      table section lacks are the 3.4 and 6.2 holds below. Read, every
      one of the twelve without a counterpart and the 226 partials
      whose V2 counterparts together cover under half the V1 bytes:
      eleven of the twelve are (i) held by V2 with the fact extracted
      (nine 3.4 status representations, one 4.7, the 6.4 frustration
      rule as three per-party facts, the two 6.2 bring-down tiers Ben
      commented on, their summaries naming the standard he asked for),
      one is (iii) the 6.1 conditions chapeau; none is a miss. Of the
      partials, 144 are representations where V1 cites the whole
      sub-section with its exception chapeau and V2's own words are the
      limb (not a loss, said once); of the other 82, 78 carry the
      substance as the operative limb (30 of them on the representations
      table under REPRESENTATIONS where V1 filed them under a covenant
      family: labour, listing, absence of changes, Merger Sub, tax
      reps), two are held zero-amount facts, two are a fusion of two
      V1 facts. Ben's comments on 3.1 (the exclusion as its own fact
      with the inherited chapeau marked) and 3.16 (inherit the SEC
      document limitation) are answered by the V2 output. Defects,
      ranked by count, each with the fix proposed and none built: (1)
      3.4's nine facts quote the Article III chapeau with span id
      3d0f0a06 for the closure's 3d0f7a06 (one character), the only
      CHAPEAU span of the closure with the quote, so work package 13
      (a)'s relocation resolves it; 3.4 ran 15:21 to 15:27 UTC, before
      that rule (17:06), so the fix for the nine is a re-extraction of
      3.4 on the current worker (the manager's), plus a rule still
      missing: an inherited context component that fails to resolve is
      dropped with a note, never holding a fact whose own components
      resolved; (2) "this Article VI" as a CROSS_REFERENCE cannot
      resolve (three 6.4 facts): resolve Article references to the
      structure's article nodes, an unplaceable one a note; (3) an
      AMOUNT with no number in its words is held (four facts: "no
      shares of Company Preferred Stock", treasury shares, "the Maximum
      Cash Election Amount", the Base Amount in the Disclosure Letter):
      extend work package 14's COUNT rules to AMOUNT (none to 0, a bare
      defined term a FORMULA form, a disclosed-elsewhere value a
      DISCLOSED form), none a hold; (4) a LIST of section references
      without LIST_ELEMENT children holds the two 6.2 tiers: make the
      elements in code from a comma-and list of references before the
      rule, and the layer-rule line; (5) 4.7's three facts
      PROPOSAL_EVIDENCE_NOT_EXACT, read as a quote across an SEC page
      footer (5.4's "the Transactions, 49 the Company" shows the
      pattern): match a quote with the footer tokens source-display.js
      knows skipped; (6) 3.27 and 4.13 fuse "has not taken any action"
      and "knows of no fact" into one fact against OPERATING-RULES'
      one-effect rule: a representations extractor line and a reviewer
      note; (7) ten facts of 3.5, 4.4 and 5.1 make each filing
      exception of a no-conflicts representation its own fact: the
      REPRESENTATIONS layer rule makes an exception an EXCEPTION
      component unless the family's table has a row per exception (MAE
      keeps its rows). Plan evidence: Phase 6's "Compare the rendered
      V1 and V2 result" box is answered for NCS by this note; the plan
      has nothing wrong here, and (101)'s "generation 5 is the
      generation to compare by table" is done. Report changes beside
      the note (code, so npm run test:active ran: 752 of 753, the one failure the known Codex-client final-message test): a
      table row lists its V1 counterparts once each, strongest first,
      three shown and the rest counted; a V1 fact V1 held is no
      counterpart; a long statement keeps its head and tail.
      (125) 2026-10-18 20:55 to 21:30 UTC (implementer C), the design
      note for the Query on layered facts, no code:
      docs/codex-program/notes/QUERY-ON-LAYERED-FACTS-DESIGN-2026-10-18.md,
      on finding (163)'s brief and Ben's words ("probably the first
      thing we build as it will drive the side bar etc"). What it
      holds: the questions Ben's review put to the corpus (the fee's
      triggers, the 48-hour notice, the pandemic carve-out with its
      carve-back, the 3.1 "lines of separation" across deals, the reps
      and their bring-down, a category for every boilerplate rule),
      each with the shape of its answer, which sort into three kinds
      (find deals by a coded answer, compare a provision across deals,
      read one deal's provision with its evidence); what the conclusions
      cells already give as filter axes (30 sections, 49 tables, 66
      vocabulary columns with 449 codes, 34 value columns, 46 fixed row
      lists, the cited words on every coded cell), reaching V9 runs
      only and, for the limbs, waiting on Q5; what the sidebar on a hit
      needs (the fact with its tree and offsets, the section text the
      offsets point into, the matching cell with its component_refs,
      the agreement's identity, the review trail), read from
      EvidenceSidebar's props; what the published-facts read lacks,
      in the order a build meets it: any release (zero heads on the
      branch), the conclusions cells in the release (compileReviewSummary
      writes components, headline, coverage_only and section_reference
      and nothing else; "conclusions" appears in none of review-state,
      release-candidate or phase-3-store), the section text, indexes
      (none on table_key, row_label or a cell), the codes across shape
      versions, the deal's name (no product table holds the parties),
      and filters beyond family and subtype. The build order: step 1,
      a week, the cell query over READY draft runs on the provisions
      page's own reads (table, row, column, code or number; the results
      as the provisions page's tables with the matching rows and the
      existing sidebar); step 2, after the first release, the same
      query on the release pointer with the cells published or joined;
      step 3, after four or five releases and Q5, the compare view
      with the limbs aligned by canonical name, the rail and the code
      map per shape version, at which point legacy Compare's job is
      done. Eight questions for Ben (Q-A to Q-H: drafts first or
      releases only; a form or a sentence; matching rows or the whole
      table; deals as columns or as row groups; cells published into
      the release or read from the run; the deal's name from the filing
      or typed; re-publish or a code map when a vocabulary changes;
      whether held facts are ever queryable), written as questions, not
      choices.
      (126) 2026-10-18 21:30 UTC (implementer C), Q5's AI pass, built
      and dry-run, no live call. `scripts/product/propose-rep-limb-canon.js`
      (library `lib/product/rep-limb-canon.js`,
      `tests/product-rep-limb-canon.test.js`, in test:active) takes the
      harvest JSON of finding (120) and asks, one request per
      representation row, for the canonical limb list with
      sub-representations grouped under a category where the names
      share a subject (Ben: "we need to get to canonical (and perhaps
      some of them are sub reps under a category) - wait untiil we have
      a few deals and see if we can AI it?"), every harvested name
      mapped to one proposed limb, a decided name kept exactly, a doubt
      written as a question for Ben. The request carries fixed
      instructions and a response contract, the row, the decided names
      and every harvested name with its count, its cluster and one
      example summary, and is keyed by the shared adapter's call key,
      so a recorded answer replays exactly (lib/product/model-adapter.js
      createRecordedModelAdapter); it goes through the Anthropic API
      provider's adapter at the extraction tier (call kind EXTRACTION,
      claude-opus-5 at high effort; the shared call-kind map, which the
      hosted worker compares against every run's stored config, is not
      widened). Every answer is checked against its request (the row
      copied, each name mapped once, no invented name, each decided
      name kept) and kept with its problems named. Three modes:
      --dry-run (the default) writes the requests and the estimate and
      makes no call; --recorded <file> answers from a recording (the
      tests' path); --live calls the API and writes recording.json so
      the pass replays without a second call. On the harvest in hand
      (Metsera 8 and NCS 5): 43 requests (the nine rows with no limb
      name, Brokers; Finders among them, get none), 53,708 input tokens
      and 20,720 output tokens estimated at four bytes a token and 40
      tokens a name, $0.79 at the pricing table (input $0.27, output
      $0.52), uncached; with Olaplex and Apogee in, about twice the
      names, so about $1.60. The command the manager runs once the two
      deals are READY under V2, on a machine with ANTHROPIC_API_KEY
      (and ANTHROPIC_WORKSPACE_ID) and the branch's database keys:
      `node scripts/product/harvest-rep-limbs.js --run 72d94dd2-cb59-49cf-8f46-c89d161b7769 --run 51577c57-41b1-4b75-bcdf-c84ef2558589 --run <olaplex V2 run> --run <apogee V2 run> --out docs/codex-program/notes/Q5-REPRESENTATION-LIMB-NAMES-PROPOSAL-<date>.md --json /tmp/q5-harvest.json`
      then
      `node scripts/product/propose-rep-limb-canon.js --harvest /tmp/q5-harvest.json --out-dir /tmp/q5-canon --live`
      (a dry run first without `--live` prints the estimate for that
      harvest); the proposal is `/tmp/q5-canon/proposal.md`, to be
      copied beside the harvest note for Ben, and
      `/tmp/q5-canon/recording.json` replays it with `--recorded`.
      Ben decides the names; the script writes nothing into the table
      shapes. npm run test:active: 766 of 767, the one failure the
      known Codex-client final-message test. No run, worker or sandbox
      touched; no live model call made.
      (106) 2026-10-18 21:30 to 23:30 UTC (implementer B), work package
      B3 on the manager's message of 21:05 UTC and Ben's decision in
      (166) ("I'm not sure what you mean but I don't care boaut the old
      site, you can move over whener you like"): the production move,
      prepared and not run on production. scripts/product/move-to-
      production.js over lib/product/production-move.js, two direct
      Postgres connections (the Supabase project's database connection
      as the postgres role; the URLs from the arguments or
      MOVE_SOURCE_DATABASE_URL and MOVE_TARGET_DATABASE_URL, never
      printed): (a) the 42 files under supabase/migrations applied in
      order to the target in one transaction and recorded in Supabase's
      own ledger, supabase_migrations.schema_migrations, the table the
      CLI keeps (a file counts as applied when the ledger carries its
      name or its version, because the branch runner records names
      under its own versions: the preview branch's ledger holds 20 rows
      for the files from 20260905224000 on and none for the first 22,
      which its runner applied under other versions; the production
      project's ledger holds three rows, the old site's RLS hardening
      of 2026-08-02, and no product_ table or product_private schema;
      pgcrypto is installed in schema extensions on both); (b) one
      run's rows carried table by table in foreign-key order (36 tables
      from the source document and its structure to the release
      pointer; the pointer travels only when it selects this run's
      release; product_run_sandboxes, which names the hosted sandbox a
      run holds, never moves), each row inserted once by the table's
      own keys (ON CONFLICT DO NOTHING) and, when already there,
      compared column by column, timestamps carried as the database's
      text so microseconds survive; (c) the proof: the product's own
      analysis read, review read for every actor with access and
      published read for the source, through the stores over a
      node-postgres facade (lib/product/pg-store-facade.js) on each
      side, compared whole. `--dry-run` (the default) reads and prints
      the migrations it would apply and every table's source and target
      rows; `--apply` writes and needs `--confirm-target <project ref>`
      matching the target host, so a production apply is a deliberate
      act; a second apply applies no migration, inserts nothing and
      reports every row already there. Proof on the embedded Postgres,
      tests/product-move-to-production.test.js (two databases, the
      source migrated and seeded with the Concho synthetic draft
      reviewed, published, evaluated and activated; the dry run reads
      42 to apply and every target table absent and writes nothing; the
      apply migrates, inserts every source row, and the three reads are
      equal; the second apply changes nothing; a ledger renumbered as
      the branch runner does applies nothing twice): 1 of 1, about 140 s, mostly the synthetic runner.
      Added to the CI database job. Dry run against the preview branch,
      by the same count queries the script runs, read by SQL (no
      connection string here): Metsera generation 8 (run 72d94dd2):
      source document 1 (2.6 MB), structure 1, run 1, submission request
      1, section work 85, model calls 313 (12 MB), closures 85, spans
      6,239 (3.7 MB), closure spans 7,047, routings 85, section results
      85, residual passes 85, proposition groups 974, proposals 974
      (3.5 MB), proposal spans 2,298, fact components 5,772, headlines
      964, conclusions 865, fact links 568, link spans 603, issues 259,
      coverage assertions 6,639, drafts 1, draft revisions 2, audit
      events 2, draft analysis 1, run access 1, retry events 2;
      identity reviews, review session, revisions, actions,
      publications, releases and heads 0. NCS generation 5 (run
      51577c57): the same shape with section work 104, model calls 393
      (19 MB), spans 6,583, closure spans 7,750, proposals 1,037,
      components 5,879, headlines 1,015, conclusions 875, links 601,
      issues 309, coverage 7,184, retry events 6; review and release
      rows 0. So today the move would carry each run's analysis and
      nothing published: the release rows appear the minute Ben's
      review is published and activated on the preview branch, and the
      move carries them then; run on the preview branch after the
      review, not before. What the production deployment needs beyond
      the database, by name only (the API refused to list the project's
      variables to this session, so the names are the code's): the
      Supabase pair for the target (NEXT_PUBLIC_SUPABASE_URL,
      NEXT_PUBLIC_SUPABASE_ANON_KEY, SUPABASE_URL,
      SUPABASE_SERVICE_ROLE_KEY) pointed at the production project
      instead of the preview branch; the login (SESSION_SECRET,
      AUTH_USERNAME, AUTH_PASSWORD); the scripts' bearer
      (PRODUCT_INTERNAL_TOKEN); the schema switch
      (NEXT_PUBLIC_PRODUCT_LEGAL_SCHEMA_VERSION, set to LEGAL_SCHEMA/V2
      as on the preview); the worker (PRODUCT_MODEL_PROVIDER and, per
      provider, PRODUCT_CLAUDE_CODE_OAUTH_TOKEN or ANTHROPIC_API_KEY
      with ANTHROPIC_WORKSPACE_ID; VERCEL_TOKEN, VERCEL_TEAM_ID,
      VERCEL_PROJECT_ID for the sandbox scripts run outside a
      deployment); CRON_SECRET for the watch route. The alias: the
      Vercel project precedent-machine (prj_nMyk8ev0VM2nhNyYnkshoz7H77vl)
      has one domain, precedent-machine-zeta.vercel.app, its production
      alias; deal-corpus-preview.vercel.app is the branch alias of
      codex/product-implementation-plan-20260904 (finding (26)); the
      production deployment is whatever is promoted to the production
      alias, so the move's deployment step is a promotion of the
      branch's build with the production environment's variables, or a
      merge to the production branch, the manager's choice. The sandbox
      pool (implementer D, finding (140)): the named sandboxes
      pm-codex-preview-worker and pm-codex-preview-worker-2 are created
      against one Vercel project and reach the database through the
      SUPABASE pair the wake passes, so a production worker needs no new
      sandbox, only the production pair in the deployment's variables;
      product_run_sandboxes starts empty on the target and the first
      production wake fills it. The old site's tables on the production
      project, untouched by the move, which knows only the product_
      tables the migrations create: claims (75,675 rows, 133 MB),
      provision_cards (11,476), provisions (12,816), parser_regions
      (6,420), deals (40), provisions_archive_20260706 (8,481),
      ingest_jobs (376), ingest_job_events, ingest_job_dependencies,
      ingest_job_artifacts, ingest_runs, consideration_treatments,
      consideration_equity_provisions, deal_candidates, corrections,
      coding_tasks, run_reports, transaction_steps, deal_quality_metrics,
      election_options, election_mechanisms, saved_queries,
      provision_field_groups, provision_cross_references,
      provision_bring_downs, ioc_positive_obligations,
      ioc_negative_obligations, users, annotations, deal_topology,
      closing_condition_cited_provisions, closing_condition_bring_down_
      tiers, proration_rules, termination_fee_triggers,
      definition_components, material_contract_categories,
      provision_analytical_flags, representation_mae_subclauses,
      signoffs, comments, comparisons: 41 tables, every one left as it
      is. One caution for the manager's apply: migration
      20260912190000 runs ALTER ROLE service_role SET statement_timeout,
      which the Supabase migration runner applied on the preview branch
      as the postgres role; if the manager's connection role is refused
      that statement, the transaction rolls back and the script says
      so, nothing half-applied. npm run test:active: 769 of 770, the one failure the known Codex-client final-message test.
      (127) 2026-10-18 21:30 to 22:15 UTC (implementer C), work package
      C3 on finding (166) (Ben: "btw let's do major biopharma deals as
      the basi sfor the build out of next searches, starting > $1bn"):
      docs/codex-program/notes/BIOPHARMA-DEALS-OVER-1BN-2026-10-18.md,
      documentation only, no intake submitted. Thirty-four public-target
      biopharma and pharma acquisitions announced 2025-01-01 to
      2026-10-18 at or above about $1bn, each with acquirer, target,
      announcement date, headline value and its source (four trackers
      and the parties' releases), the structure read from the
      agreement's own text (the Offer defined for a tender, Contingent
      Value Right for a CVR, the Scheme for a UK or Irish scheme) and
      the EDGAR Exhibit 2.1 URL found by full-text search and fetched
      in full (every one answered 200; the two scripts are in the
      session's scratchpad). Three are in the corpus (Metsera, Apogee,
      Arcellx), 31 are not. By form: 17 two-step tender offers (the
      Dutch offer for Merus among them), 13 one-step cash mergers,
      three schemes (Verona, Centessa, Avadel), one stock merger
      (Indivior / Supernus, 1.5401 shares per share, the only stock
      deal); 11 carry a CVR; the three schemes and the Dutch offer are
      filed as Transaction Agreements. Below the line: Regulus,
      Esperion, Theravance and XOMA (under $1bn upfront); the tools,
      diagnostics and device deals (Exact Sciences $21bn, Bio-Techne
      EV $11.3bn, Integer, Personalis, BioLife); the private targets
      the trackers carry. The intake cannot take Recordati (Italian
      offer, $12.4bn) or PolyPeptide (Swiss), neither an SEC
      registrant; it takes the four scheme and Dutch-offer agreements
      by URL but their mechanics are not the schema's (Court sanction,
      a Scheme Document, a post-offer reorganisation), so they go after
      the Delaware deals. Metsera's Amendment No. 1 of 2025-11-07 is
      listed beside the original (generation 8 is the original). The
      three to run first, for drafting variety against the corpus's
      two cash mergers and one CVR tender offer: GSK / Nuvalent (a
      $10.6bn two-step tender offer without a CVR), Indivior / Supernus
      (the stock merger of equals, an exchange ratio the consideration
      tables have never seen) and J&J / Intra-Cellular ($14.6bn, a
      plain one-step cash merger, the control); fourth, Curium /
      Lantheus (a one-step merger with a $12 CVR and a private-equity
      acquirer) or Novo Nordisk / Akero. Values are the trackers'
      headline figures (equity, or EV where marked), not read from the
      agreements; the agreements' consideration is what the intake
      will extract. No run, worker or sandbox touched.
      (107) 2026-10-18 22:15 to 23:59 UTC (implementer B), work package
      B4 on the manager's message of 22:15 UTC: the Lilly / Verve
      structure failure ((170): the intake failed twice at structure
      build with STRUCTURE_PARENT_SPAN), reproduced locally through
      the intake's own path (the exhibit's 600,983 bytes served to
      createSecIntakeAdapter's fetch, then buildAgreementStructure; no
      database, no model), fixed for every agreement, pinned. The
      clause: "Annex I / CONDITIONS TO THE OFFER", the tender offer's
      conditions annex after the signature pages (canonical bytes
      292,387 to 297,901 of 369,081). lib/parser-v2/structural.js
      gives that annex section articleNumber "I" (the annex's own
      numeral, from "Annex I"), and the sectionizer
      (lib/canonical-v2/native-producer/deterministic-sectionizer.js)
      parented every section by that numeral alone, so the annex
      became a child of the main agreement's ARTICLE I (bytes 9,504 to
      26,625), 265 kB before it, and the structure builder refused the
      child outside its parent's span. The rule missed it because it
      never asked whether the article's span held the section; a
      letter-numbered annex ("Annex A") never collided, "Annex I" did
      whenever the agreement has an ARTICLE I. Two rules, both for
      every agreement: (a) an article is a section's parent only when
      its span holds the section; an annex is never an article's
      child; a numbered section whose numeral's article does not hold
      it goes to the article whose span does, else to the root; (b)
      the last main-agreement article ends at the first retained
      exhibit scope or the first annex after the article's start,
      whichever comes first (before, only an EXHIBIT scope bounded it,
      so ARTICLE IX's span covered the annex, and in two agreements
      the last section's limb walk claimed the annex's own limbs:
      Merck KGaA / SpringWorks' 9.13 carried the definitions annex's
      MAE limbs as 9.13(i) to (xi), Novartis / Tourmaline's 8.13(k)
      carried Annex I's conditions as 8.13(k)(a) to (h) beside the
      annex's own Annex-I(a) and (b); those duplicates are gone, 413
      to 402 and 362 to 350 nodes, every other node unchanged). Pinned
      in tests/product-phase-1.test.js ("a trailing annex after the
      signature pages bounds the last article and is never its child")
      on the exhibit's own bytes: tests/fixtures/product/verve-annex-i-
      boundary.v1.json holds the canonical text from the last
      signature page through Annex I's conditions (a) and (b) (2,448
      bytes at canonical offset 291,629, the annex heading at 292,387,
      the whole text's sha256 90242bd6 recorded), appended to a
      synthetic nine-article main agreement; the test asserts the
      annex hangs from the agreement, starts on its heading and runs
      to the end, ARTICLE IX ends where the annex begins, the last
      section never reaches into it, the conditions are the annex's
      limbs and not the last section's, and every node lies inside
      its parent. The sweep the manager asked for, the same path on
      every URL of docs/codex-program/notes/BIOPHARMA-DEALS-OVER-1BN-
      2026-10-18.md (42 fetched: the 34 agreements, the four it lists
      below the line and four press releases): before the fix 35 of 42
      built and 7 failed with STRUCTURE_PARENT_SPAN, all two-step
      tender offers with a trailing conditions annex (Verve, GSK /
      Nuvalent, Sanofi / Blueprint, Genmab / Merus, Merck / Terns,
      Neurocrine / Soleno, Merck KGaA / Bio-Techne); after it 42 of
      42 build (Verve 336 nodes); of the 35 that built before, 33 are
      unchanged and the two above lose only their duplicates.
      The repository already carried the defect's trace: the
      sectionizer's own corpus test (tests/canonical-v2-native-
      sectionizer.test.js, not in test:active) failed on the head with
      "topbuild: ARTICLE VII [381113,412860) overlaps its next sibling
      Annex-C [406279,412860)" in two tests; both pass now; its one
      remaining failure (the LONE_CANDIDATE tripwire) fails on the head
      before this change and is not this work's. No intake submitted,
      no run or sandbox touched; Verve's two failed runs stay as they
      are for the manager (finding (170): Ben, "I don't think we
      intake until E is done and we have reduced cost"). Ben's rule
      kept ("everything to be driven by coding and not just a layer on
      top so all edits need to be repeatable across corpus"): the fix
      is in the one sectionizer every intake runs, not a Verve
      special case. npm run test:active: 774 of 775, the one failure
      the known Codex-client final-message test.
      (128) 2026-10-18 21:55 to 22:45 UTC (implementer C), work package
      C4, the tender-offer and stock-deal readiness of the schema:
      docs/codex-program/notes/TENDER-OFFER-AND-STOCK-DEAL-SCHEMA-GAPS-2026-10-18.md.
      GSK / Nuvalent (a two-step tender offer) and Indivior / Supernus
      (the stock merger of equals) read in full from their exhibits, no
      intake, 45 provisions set against the V2 schema, LEGAL-RULES and
      the table shapes, and against what the extractor did with the
      corpus's one tender offer (Arcellx: its V2 run filed Article I's
      Offer under nine families, CONSIDERATION_PACKAGE, DOCUMENT_FILING,
      OBTAIN_FINANCING and TRANSACTION_STEP among them, and Annex I
      under BRINGDOWN and GENERAL, because no subtype names the Offer:
      "offer" is in the schema twice, "tender" never). The count: of 24
      tender-offer provisions, 11 had no family, subtype or row (the
      Offer's commencement, expiration, extensions, amendment
      restrictions and termination; the Minimum Tender Condition and
      its waiver rule; the Merger's condition that the Offer was
      consummated; the Section 251(h) merger without a vote; both
      parties' Offer-failure termination rights); of 21 stock-deal
      provisions, 5 had no row (fractional shares, the combined-company
      governance, Parent's reciprocal no-shop, Parent's recommendation-
      change termination, the second vote's failure). Added, as rows
      and codes on existing subtypes (decision 34, work package C4,
      `applyTenderOfferAndStockDealRows`, the contract regenerated,
      pinned with the agreements' words in
      tests/product-table-shapes.test.js): conditions-table "Minimum
      tender condition", "Offer consummated (Acceptance Time)", "Parent
      stockholder approval" and the vote standard MAJORITY_OF_VOTES_CAST
      (Supernus 4.27(b): "a majority in voting power of the outstanding
      Indivior Shares present in person or represented by proxy ... and
      entitled to vote"); the mutual termination row "Parent stockholder
      vote not obtained"; Parent's "Offer expired on a failed Offer
      Condition" (placed before the written-consent rows work package 19
      (d) pins as last); the Company's "Offer not commenced or not
      consummated" and "Parent change of recommendation"; the window
      code BEFORE_ACCEPTANCE_TIME on both termination windows (Nuvalent
      8.2 to 8.4: "at any time prior to the Acceptance Time"); the
      votes rows "Merger without a vote (Section 251(h))" and "Parent
      stockholders' meeting"; the proxy rows "Schedule TO (Offer
      Documents)", "Schedule 14D-9" and "Registration Statement (Form
      S-4)"; the consideration row "Cash in lieu of fractional shares";
      guidance on each table saying which words land where. Every row
      is reachable now through the readout's row_label. What waits on
      Ben, proposed in the note and not built: an Offer step (five
      subtypes: commencement, expiration, extension, amendment
      restriction, termination, with the Acceptance Time as the first
      step's closing), a MINIMUM_CONDITION subtype with a value, an
      OFFER_FAILURE termination subtype, three LEGAL-RULES lines (the
      Offer as its own step; an Annex I condition as the first step's
      closing condition; no approval condition or meeting under Section
      251(h)), the ratio's form and the adjustment clause as grid
      columns, a combined-company governance table, a Parent no-shop
      section or obligor axis with Parent's Superior Proposal row, and
      a Dividends table for the Special Dividend. Not changed: the
      schema, LEGAL-RULES, any subtype or fact type. npm run
      test:active: 774 of 775, the one failure the known Codex-client
      final-message test. No run, worker or sandbox touched.
      (129) 2026-10-18 22:15 to 23:05 UTC (implementer C), work package
      C5, the three intakes of 21:44 UTC held at
      DOCUMENT_IDENTITY_REVIEW. Read by SQL on the preview branch
      (product_document_identity_reviews joined to product_analysis_runs
      and product_source_documents), nothing resolved, no run woken. The
      gate: lib/product/sec-intake.js extractDocumentIdentity scores the
      exhibit on nine rules (CIK, accession, exhibit type confirmed,
      exhibit type conflict, filename conflict, parties, agreement date,
      revision, completeness); one failure makes identity_status
      NEEDS_REVIEW, lib/product/phase-1-foundation.js attaches the
      structure with the reasons, product_phase1_attach_structure writes
      the review row and leaves the run QUEUED at
      DOCUMENT_IDENTITY_REVIEW, and the hosted worker refuses such a run
      (PRODUCT_HOSTED_IDENTITY_REVIEW_REQUIRED). The rows, all OPEN,
      resolution null: cd1d3e91 (Vertex / Crinetics, review 27850060)
      reasons ["AGREEMENT_DATE_UNCONFIRMED"]; 436276fe (Lilly /
      Centessa, review 6afe2802) ["PARTIES_UNCONFIRMED"]; 94cd879e (Novo
      Nordisk / Akero, review a40bb6cd) ["PARTIES_UNCONFIRMED"]. Each
      flag reproduced locally by running the committed extractor over
      the exhibit through the canonical-text conversion, and each is a
      parser miss on a sound document, not a doubt about which document
      it is: all three are the complete, original, execution-version
      EX-2.1 (revision "original", looks_like_complete_document true, no
      amendment language). Crinetics: parties found (Vertex PARENT,
      Clark Merger Sub MERGER_SUB, Crinetics COMPANY), exhibit
      confirmed; the cover line reads "DATED AS OF JULY 6, 2026," with a
      trailing comma and isoAgreementDate anchors its pattern on the
      year at the end of the line, so the line fails and the preamble's
      "dated as of July 6, 2026 (this "Agreement" ...)" is mid-line,
      which the rule never reads; the date is in the document twice and
      consistent. Centessa: date 2026-03-31 confirmed; the preamble
      names Eli Lilly and Company ("Parent"), LDH XV Corporation
      ("Purchaser") and Centessa Pharmaceuticals plc "(the "Company"
      and, together with Parent and Purchaser, the "Parties")"; the
      embedded-role pattern requires the closing parenthesis straight
      after "Company", so the compound parenthetical loses the Company,
      and without a Company partyIdentity falls back to the cover
      caption, which it reads only from a line beginning "by and among"
      while this cover says "among"; parties []. Akero: date 2025-10-09
      confirmed; the preamble reads "by and among: Novo Nordisk A/S, a
      Danish aktieselsab ("Parent"); NN Invest Sub, Inc, ... ("Merger
      Sub"); and Akero Therapeutics, Inc., ... (the "Company")"; the
      name character class has no "/" so "Novo Nordisk A/S" never
      matches, the buyer is missing, the caption fallback fails on
      "among:" and parties is []. Avadel (91fe48a1) passed because its
      cover carries "dated as of October 22, 2025" alone on a line and
      its preamble's two parties, Alkermes plc ("Parent") and Avadel
      Pharmaceuticals plc ("Company"), fit the pattern. What the
      function accepts: product_phase1_resolve_identity(p_run_id,
      p_resolution) (current body in
      supabase/migrations/20260905190000_product_substantive_section_work.sql,
      service_role only) requires the run at DOCUMENT_IDENTITY_REVIEW
      (else 55000, replayed silently when the same resolution was
      already stored), requires p_resolution non-null and not {}
      (22023), and checks nothing else about its shape: it stores the
      JSON verbatim as resolution, marks the review RESOLVED, inserts
      product_section_work for every leaf SECTION node and moves the run
      to QUEUED at SECTION_ANALYSIS. What submits it: POST
      /api/product/analysis/<run_id>/identity
      (pages/api/product/analysis/[id]/identity.js,
      lib/product/identity-handler.js), reached from the "Confirm this
      agreement" button on the intake panel of pages/review/index.js
      (components/product/ProductIntakePanel.jsx, which lists the
      parties, filing, date and the reasons); the handler ignores the
      request body and sends the one fixed resolution {"confirmed":
      true, "confirmed_by": <actor>}, the actor being the session
      subject from the browser or AUTH_USERNAME (default "ben") for the
      internal bearer token; no script, worker or other route resolves a
      review. So the exact resolution for each of the three, were Ben to
      say yes, is the same call: POST
      /api/product/analysis/cd1d3e91-2e20-45de-9657-a42c689eff68/identity,
      .../436276fe-d733-4d03-bd2e-59c84fb55766/identity and
      .../94cd879e-08e0-4b68-8115-8424b1fa096d/identity with an empty
      JSON body, each stored as {"confirmed": true, "confirmed_by":
      "ben"} (or by SQL as select
      product_phase1_resolve_identity('<run_id>', '{"confirmed": true,
      "confirmed_by": "ben"}')). Is any of it a lawyer's decision: no.
      The gate asks only whether this is the agreement intended, and for
      all three it is; the confirmation is mechanical. Two things for
      Ben to know before the word is given: (a) confirming does not
      repair the record, the source document keeps parties [] for
      Centessa and Akero and agreement_date null for Crinetics, which
      the review and preview pages then show as unknown (the display
      repair in lib/product/review-handler.js only recovers suffix-only
      names, not empty lists); (b) resolving moves each run to QUEUED at
      SECTION_ANALYSIS, which costs nothing until a worker is woken
      (Ben: "I don't think we intake until E is done and we have reduced
      cost"). The repeatable fix (Ben: "everything to be driven by
      coding and not just a layer on top so all edits need to be
      repeatable across corpus"), proposed and not built in this
      package: in sec-intake.js let the date rule drop trailing
      punctuation on the cover line, let the embedded-role rule accept a
      compound parenthetical (the "Company" and, together with ..., the
      "Parties"), add "/" to the entity-name character class (A/S), and
      let the caption fallback read a cover line beginning "among" or
      "among:"; each pinned with these three preambles as fixtures. The
      fix helps the next deals on the >$1bn list (note of (127)); for
      these three the stored source document is found by URL on
      re-submission and never re-scored, so their records stay as
      extracted unless the source row is re-intaken. Documentation only;
      no code, schema or rule changed. npm run test:active:
      774 of 775, the one failure the known Codex-client final-message
      test. No run, worker or sandbox touched.
      (108) 2026-10-18 23:00 to 2026-10-19 00:40 UTC (implementer B), work
      package B5 on the manager's message of 22:55 UTC: the local path of
      (107) made the product's own pre-intake check.
      scripts/product/structure-check.js <url> [--json] [--schema
      <version>] [--provider <hosted provider>] [--generation N]
      [--attempts N] over lib/product/structure-check.js: exactly the
      intake's steps with no database and no model call, the SEC
      adapter's own fetch (its User-Agent, timeout and byte limit), the
      canonical text, the document identity (extractDocumentIdentity
      inside the adapter; lib/product/sec-intake.js untouched, C6 is
      C's) and buildAgreementStructure; it prints the node count by
      kind, every article's byte span with its child count, every annex,
      exhibit or schedule the sectionizer keeps at the root, any node
      outside its parent's span, the identity status with its reasons,
      the parties and date, and the submission fingerprint. The
      fingerprint is product_phase1_create_run's own (the migration of
      2026-09-05: sha256 of source_document_id, schema_version,
      prompt_bundle_version, model_config::text, explicit_generation and
      max_attempts joined by chr(31)), with Postgres's jsonb text
      rendering reproduced in code (keys by length then bytes, ", " and
      ": " separators; jsonbText checked against Postgres 17 on the
      embedded database) and proved on two fingerprints the preview
      branch stores: Metsera generation 8 (run 72d94dd2) and NCS
      generation 5 (run 51577c57, its stored config with
      max_output_tokens 64000) reproduce byte for byte from their rows'
      inputs. The schema, prompt bundle and model config are the
      environment's (PRODUCT_LEGAL_SCHEMA_VERSION, PRODUCT_MODEL_PROVIDER)
      or the flags, so the fingerprint printed is the one the deployment
      would compute only when the flags name its settings; the report
      says which were used. One caution the run showed: SEC serves the
      same exhibit with small byte variations between fetches (Verve:
      600,983 bytes on 2026-10-18's fetch, 600,995 on this one; canonical
      text identical, sha256 90242bd6), so the source document id and
      the fingerprint can differ from an earlier intake's while the
      canonical text, the structure and the identity do not. Pinned in
      tests/product-structure-check.test.js (in test:active): the jsonb
      rendering on values read back from Postgres, the two preview
      fingerprints, the Verve annex fixture of (107) served through a
      fake fetch as an HTML exhibit (identity CONFIRMED with the three
      parties and the date, 13 nodes, Annex I at the root with two limbs,
      the last article ending at the annex, no node outside its parent,
      the fingerprint equal to the function's), a 404 reported as the
      intake stage and a whitespace exhibit as the structure stage,
      neither thrown. The sweep the manager asked for, the 34 agreements
      of docs/codex-program/notes/BIOPHARMA-DEALS-OVER-1BN-2026-10-18.md
      plus Metsera's Amendment No. 1 (35 URLs, LEGAL_SCHEMA/V2, the
      subscription config, about 119 s of fetches, nothing submitted),
      appended to that note as a table: 35 of 35 build; 28 identities
      CONFIRMED, seven NEEDS_REVIEW (PARTIES_UNCONFIRMED on Avidity,
      Centessa, Akero, Supernus and the amendment; AGREEMENT_DATE_
      UNCONFIRMED on Crinetics, Day One, Supernus and the amendment;
      REVISION_UNCONFIRMED and DOCUMENT_INCOMPLETE on the amendment
      alone, right for an amendment); eleven carry Annex I at the root.
      What the check found that an error never would: eight agreements
      build to almost nothing. Akero 2 nodes, Amicus 2, KalVista 14,
      Cidara 22, Dynavax 35, RAPT 80, Apellis 100, Catalyst 273 with no
      SECTION at all. Every one heads its sections with a bare decimal on
      its own line ("3.17 Employee Matters; Benefit Plans." and the text
      on the next line; about 160 such lines each, contents table and
      body) without the word "Section", which the sectionizer's heading
      rules do not take, and Akero, Amicus and KalVista name their
      articles "Section 1. MERGER TRANSACTION" and get no ARTICLE. An
      intake of any of them would pay for the model over a handful of
      huge nodes: the same cost as a full structure and almost none of
      the result. Proposed, not done (B5 was "small and complete"): a
      sectionizer rule, for every agreement, accepting a line of the
      form "<n>.<m> <Title>" as a section heading when its number
      follows the previous accepted section's in sequence and the
      article (or "Section <n>." heading) it belongs to precedes it,
      pinned on Akero's and Cidara's bytes the way (107) is; the
      manager's call whose work package it is (A's defect track or B).
      Until it lands these eight are not ready to intake, and the check
      says so before a run is paid for. No intake submitted, no run,
      worker or sandbox touched. npm run test:active: 784 of 785, the
      one failure the known Codex-client final-message test.
      (130) 2026-10-18 23:00 to 2026-10-19 00:10 UTC (implementer C),
      work package C6, the identity extractor's parser misses of (129)
      fixed as rules for every agreement, in lib/product/sec-intake.js
      (Ben: "everything to be driven by coding and not just a layer on
      top so all edits need to be repeatable across corpus"). (a) The
      agreement date now has two sources that must agree: the cover's
      "Dated as of" line, trailing punctuation and a missing "as of"
      allowed ("DATED AS OF JULY 6, 2026,"; Indivior / Supernus "Dated
      August 1, 2026"), and the preamble sentence, read mid-line only
      around the agreement's own definition (the first (this
      "Agreement") or ("Agreement")) and only when the date is followed
      by that definition or by the parties' "among" / "between" ("dated
      as of July 6, 2026 (this "Agreement" ...)", "is made and entered
      into as of October 25, 2025, among"), so a recital's "Mutual
      Confidentiality Agreement dated January 23, 2026, between the
      Company and Parent" (Chiesi / KalVista) is never read; one
      distinct value is the date, two are AGREEMENT_DATE_CONFLICT. (b)
      The role parenthetical accepts the compound closing form (the
      "Company" and, together with Parent and Purchaser, the "Parties")
      (Lilly / Centessa; Merck / Verona Pharma; Genmab / Merus), and
      "Bidco", "Acquiror" and "Acquirer" join the role words. (c) A
      party's name admits "/", accents, both apostrophes, digits first
      ("89bio, Inc.") and up to three short comma segments ("NN Invest
      Sub, Inc", "Merck KGaA, Darmstadt, Germany"); the legal
      description between name and role may carry its own unquoted
      parenthetical ("a company limited by shares (Aktiengesellschaft)
      incorporated under the laws of Switzerland"; "(Aktieselskab)";
      "(naamloze vennootschap)"); a party may start after "by and
      among:" or "among:" with a colon; and the preamble's verbs ahead
      of "among" / "between" are stripped from a name that started at an
      earlier comma (the old rule stored "among GlaxoSmithKline LLC",
      "among Pfizer Inc." and "among SANOFI" as Parent names). (d) The
      cover caption is read under "among", "among:" and "by and among",
      description lines ("a Delaware corporation;") skipped, names not
      joined across "and" (the old rule stored "VOL HOLDINGS LLC VERONA
      PHARMA PLC" as one party), the list ending at the date line or the
      contents, and a trailing period kept ("INDIVIOR PHARMACEUTICALS,
      INC."). Pinned in tests/product-party-identity.test.js with the
      words of Crinetics, Centessa, Akero, Verona Pharma, Merus, 89bio,
      Merck KGaA, Avidity, argenx, Nuvalent, Tourmaline, Supernus,
      KalVista and Avadel (eight tests, the ten earlier ones unchanged
      and passing). The sweep: every exhibit of the 34 deals of (127)
      (35 URLs, the Metsera original and its amendment both) fetched to
      the scratchpad, converted with convertSecHtmlToCanonicalText and
      scored with extractDocumentIdentity, no intake. Before the fix, 28
      of 34 passed the gate, and of those 28, nine carried wrong or
      incomplete parties (the three "among X" Parent names; Verona's two
      names joined; "Germany" as Merck KGaA's name; "Inc." as 89bio's;
      Merus and Verona with no roles; argenx and Tourmaline without
      their Parent); six stopped: Avidity (PARTIES_UNCONFIRMED, the
      nested "(Aktiengesellschaft)"), Crinetics and Day One
      (AGREEMENT_DATE_UNCONFIRMED, the cover comma), Centessa and Akero
      (PARTIES_UNCONFIRMED), Supernus (both: no role words, "Dated"
      without "as of"). After the fix, 33 of 34 pass with every party
      named and given its role, and one stops, on rule (a): Alkermes /
      Avadel, AGREEMENT_DATE_CONFLICT, because the exhibit itself
      carries two dates, "dated as of October 22, 2025" on the cover and
      in the CVR Agreement's recital, "dated as of October 21, 2025" in
      the preamble sentence; the rule is right to stop, and which date
      is the agreement's is Ben's to say (the stored run 91fe48a1 passed
      the old cover-only rule with 2025-10-22). The Metsera amendment
      stops on PARTIES_UNCONFIRMED, REVISION_UNCONFIRMED and
      DOCUMENT_INCOMPLETE, as an amendment should. Seen in passing, not
      changed: the canonical text keeps undecoded HTML entities
      ("soci&eacute;t&eacute; anonyme" in Sanofi / Blueprint,
      "simplifi&eacute;e" in Servier / Day One), a conversion defect in
      lib/canonical-v2/sec-html-canonical-text.js for implementer A; it
      did not stop either deal. How the three held runs are resolved: by
      product_phase1_resolve_identity with the resolution of (129), not
      by a fresh intake. The repository shows a fresh intake would not
      be cleaner: lib/product/phase-1-foundation.js looks the source
      document up by URL (findSourceDocumentByUrl) before it calls the
      SEC adapter, so a new submission of the same URL under a new
      idempotency key reuses the stored SOURCE_DOCUMENT/V1 payload
      (parties [], agreement_date null, identity_status NEEDS_REVIEW),
      creates a second run and stops at the same gate with the same
      reasons, the fixed extractor never running; the source row cannot
      be dropped to force a re-fetch while the held runs reference it.
      The fixed extractor serves new URLs only (the 30 deals of (127)
      not yet submitted). What waits on the manager and Ben: deploy the
      extractor before the next intakes; resolve the three held runs
      with {"confirmed": true, "confirmed_by": "ben"} when Ben says so,
      accepting that their stored identity stays as extracted; and,
      proposed and not built, a re-score path for a stored source
      document (a service-role function that re-runs
      extractDocumentIdentity over the stored canonical_text and
      rewrites the payload's parties, agreement_date, revision,
      identity_status and identity_review_reasons, with the
      identity_version raised to DOCUMENT_IDENTITY/V2 so a record says
      which rules scored it), which would also repair the three. Not
      changed: the schema, the migrations, identity_version, any route.
      npm run test:active: 787 of 789 on the first run, the two failures
      the known Codex-client final-message test and one pin in
      tests/product-phase-1.test.js that held the old rule's "PASSAGE
      BIO, INC" without its period; the pin corrected to the exhibit's
      "PASSAGE BIO, INC." and that file re-run green (49 of 49 with the
      party identity tests), so the suite stands at 788 of 789 with the
      one known failure. No run resolved, woken or submitted; no worker
      or sandbox touched.
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
      (Ben, 2026-09-13 21:25 UTC). (Status 2026-10-23: waits for three
      deals on the Sonnet default; none has run yet, (235).) After a few agreements have run (Metsera,
      Olaplex, Apogee at least), harvest the row_detail values the extractor
      produced per representation across those runs, cluster them, and put a
      proposed canonical list per representation to Ben in one note for his
      decision; then add them to `detail_labels_by_row` in generator decision
      31 and regenerate. Ben decides the names; the code only proposes.
      Harvested 2026-10-18 (finding (120)): the proposal per
      representation is in
      docs/codex-program/notes/Q5-REPRESENTATION-LIMB-NAMES-PROPOSAL-2026-10-18.md
      from Metsera generation 8 and NCS generation 5, rerun by
      `scripts/product/harvest-rep-limbs.js` as Olaplex and Apogee
      finish; waits on Ben's names. The AI pass Ben asked for
      (finding (126)): `scripts/product/propose-rep-limb-canon.js`,
      built and dry-run, the live command and its cost (about $0.79 on
      the two deals in hand) recorded there for the manager to run once
      Olaplex and Apogee are READY under V2.
- [ ] Q4 Decide with Ben whether legacy Query and Compare migrate to this
      read or are retired. Evidence 2026-10-18 (finding (121)):
      docs/codex-program/notes/Q4-LEGACY-QUERY-COMPARE-EVIDENCE-2026-10-18.md;
      both are already off every entry point and read only legacy
      tables; the question put is retire now or keep unrouted.

      (180) 2026-10-18 21:40 to 23:10 UTC (implementer E), work package
      E1 item 1, the ledger. No run submitted, woken or retried; no
      live call; nothing written to the preview branch; no key read.
      Read from product_model_calls and the run tables by SQL:
      docs/codex-program/notes/EXTRACTION-COST-LEDGER-2026-10-18.md
      (the queries at its end), and the same reading as code for every
      run, `scripts/product/extraction-cost-ledger.js --run <id>`
      (`lib/product/extraction-cost-ledger.js`; `--snapshot <file>`,
      `--json`, `--dump-snapshot`; `lib/product/run-rows.js` gains the
      span, component, headline, conclusion and residual tables and
      `loadRunContext`). NCS generation 5, $145.68 for 1,015 VALID
      facts ($0.1435 a fact), 439 minutes: (a) output is 63 per cent
      of the money ($92.37; 3.69m extraction output tokens at 87 a
      second are 97 per cent of all call time); about 36 per cent of
      it is thinking (Metsera's CLI reports 1,249,344 of 3,512,309;
      the API path does not break it out), and of the visible JSON 30
      per cent is the agreement's own words written back twice
      (component quotes 1.02 MB and evidence_quotes 0.42 MB), 20 per
      cent is 64-hex span ids (0.95 MB), 12 per cent is the V1 roles
      the V2 page never shows; (b) fresh input is 20 per cent
      ($28.83): the extraction section block carried 16.36 MB for a
      0.31 MB agreement, cross_references 10.29 MB (33 agreements)
      and definitions 4.12 MB (13), a median 86,810 bytes of context
      per call (3.21, 193 bytes of representation, went out with
      32,078 fresh tokens, $0.30 for one fact); every agreement byte
      went at least three times, and a fifth of them (63,324 bytes,
      the definitions article and the sections most referred to) 119
      to 277 times each, 74 per cent of the 16.0m byte-sends (mean 54
      a byte); (c) cache writes are 12 per cent ($17.46): 51 distinct
      stable blocks (one per routed family set), 22 used once, against
      $1.92 of reads; table_shapes is 37 per cent of the block and
      cross_section_target_contracts, the same on every call, 13; (d)
      $13.84 and 69 call-minutes went on 37 calls of attempts that
      never committed (5.1's three capped attempts $9.29; 5.8's first
      attempt lost to the 18:34 restart with no error record $2.69;
      3.4's JSON failure $1.23; the 1.2, 2.1 and 2.2 pairs $0.64);
      (e) 62 of the 439 minutes had no call in flight (the restarts
      of findings (74), (77) and (87)), 353 had two (the worker's two
      loops). The stored per-call costs reconcile to the published
      rates to the cent; the split in (165) (6.37m fresh, 4.68m read)
      counted the failure records' whole prompt as fresh, the calls'
      own usage gives 6.11m fresh, 4.91m read, 1.76m written. Metsera
      generation 8 on the CLI: 313 calls, 10.88m input of which 9.71m
      were cache writes (each `claude -p` process writes its own
      entry and the next starts cold; free on the subscription, $191
      at the API's rates), 3.62m output, 435 minutes, 3.68 calls a
      section. Floor (read once, write the facts once): about 0.11m
      input tokens and 0.58m output, $15 ($23 with the same thinking
      share), 110 minutes serial and 13 in parallel; actual is 6x to
      10x the cost floor, 116x on input tokens, 4x to 7x on output,
      34x the parallel time floor. The manager's (167) holds: 10x is
      there, 100x is not while a frontier model writes the facts (the
      output floor alone is $14 to $23). Asked of the manager: the
      console's billed usage for the workspace over 13:27 to 20:47
      UTC, for the reconciliation line, and
      `extraction-cost-ledger.js --run` on both runs where the branch
      keys are, the two outputs kept beside the note. Baseline for
      the gate (item 5):
      tests/fixtures/product/run-cost-baseline.ncs-generation-5.json;
      `assertNoUnexplainedRise` fails a rise over 15 per cent (25 on
      call minutes a section, 10 on calls a section) unless an
      explanation names the metric.
      tests/product-extraction-cost-ledger.test.js (7 of 7), added to
      test:active.

      (181) 2026-10-18 23:10 UTC to 2026-10-19 00:40 UTC (implementer
      E), work package E1 items 2 to 5: the levers ranked, the replay
      harness, the lean request profile behind the model-config
      identity, the three-section ablation harness, the gate. No run
      submitted, woken or retried; no live call (the ablation's live
      ladder is the manager's to run); nothing written to the preview
      branch; no key read. The levers, each with its mechanism and its
      measured dollars and minutes on NCS generation 5 (the note's
      section 11): 1 the answer's format, components alone with short
      span aliases (-$28, -107 wall minutes, reading unchanged); 2 the
      Batch API (half of whatever remains; a batch runner against the
      section-lease store is the next build, not this one); 3
      concurrency, eight section loops and the parts of a split
      section together (-280 minutes to the rate limit, $0); 4 medium
      effort on extraction (-$17, -63 minutes, if the facts hold); 5
      claude-opus-5-5 (-$29 on the stored mix); 6 the agreement cached
      once instead of 14.4 MB of definitions and cross-references sent
      fresh (-$6 at Opus 5 rates, -$9 at Opus 5.5: 115,000 cached
      tokens a call cost nearly as much as the 37,000 fresh ones they
      replace; a trimmed closure, one hop and 1,500 bytes a reference,
      would be -$13 and is proposed, not built); 7 anchored quotes
      (-$9, -34 minutes); 8 two stable blocks (-$7); 9 routing and
      residual on Haiku 5.5 (-$5); 10 nothing on attempts that do not
      commit (-$14, already fixed, the gate holds it). Stacked:
      nothing changed in the reading or the model, about $92 and 70
      minutes at eight loops (1.6x); the same tier with the format,
      anchors and Opus 5.5, about $66 (2.2x); with medium effort and
      the cached agreement, if the ablation shows the same facts,
      about $42 (3.5x); with the Batch API, about $21 (7x); 10x needs
      every step and the batch runner. 100x is not available while a
      frontier model writes the facts: the floor is $15 to $23; the
      next 10x after that is a smaller model writing the facts (Sonnet
      5.5 at $10, Haiku 5.5 at $0.50 a million output tokens) and
      would lose whatever those models lose on a merger agreement's
      qualifications, carve-outs and cross-references, unmeasured on
      this corpus; the ablation harness runs the same ladder on them
      when Ben wants that number. Built, in code for every agreement:
      (a) `scripts/product/replay-run.js` (`lib/product/run-replay.js`):
      a run finalised again from its stored responses with no model
      call, every stored request rebuilt into the pipeline's request
      and keyed as a recording is (`callKey` now hashes call kind,
      prompt version and request alone), the committed attempt's split
      reproduced from the work row's error_history, the draft
      assembled and validated, the proposals compared with the stored
      ones by id and status (`--match loose` answers a changed request
      with the stored call of the same section, kind and part and
      lists the drift; `--sections` a subset; `--dump-snapshot` the
      rows and context for a rerun without the database). Proven here
      on the Concho synthetic run: the same draft by content id, zero
      calls, $0 (tests/product-run-replay.test.js); the NCS generation
      5 proof (1,015 VALID and 22 held) is one command for the manager
      where the branch keys are, below. The number of runs: the NCS
      generation 5 audit says of its 22 holds that "none needs a
      re-run to be judged", and every rule merged while it ran (work
      packages 13, 14, 18 and 19, eleven rules) is a compiler or page
      rule: each is judged by the replay on the stored answers. Of the
      thirteen generations, the ones run for a prompt, split or schema
      change needed the model for the sections whose request changed
      and no other; a validator or page change never did. (b) The
      lean request profile (`lib/product/product-model-config.js`
      `ANTHROPIC_API_REQUEST_PROFILES`, `ANTHROPIC_API_LEAN_MODEL_CONFIG`,
      `PRODUCT_ANTHROPIC_API_CALL_KIND_MAP/V2`, chosen for a new run by
      `PRODUCT_ANTHROPIC_API_PROFILE=LEAN`; a run created under it
      advances under it, `hostedModelConfigFor(providerId, run)` and
      `anthropicApiModelConfigFor` follow the run's own config by
      identity, the worker, the run route and the runner pass it
      through): in `buildAgreementSectionDraft({ requestProfile })`
      the extraction request goes out as `PRODUCT_ALL_FAMILY_EXTRACTOR/V10`
      with every closure span a short alias, the components alone (no
      roles, no evidence_quotes), a long component's words as its
      first and last four words resolved by the validator
      (`resolveAnchoredQuote`), and under the cached-agreement context
      the definitions and cross-references listed by section, span
      and first words while the provider sends the agreement's text
      once under its own 1-hour breakpoint (`cacheableContent`: the
      agreement block, one or two stable blocks, the section block;
      the stored request keeps a marker with the source document's id,
      bytes and hash; the recorded adapter's key ignores the text);
      `normaliseLeanResponse` reads the answer back into the compiler's
      shape and the section carries one LEAN_RESPONSE_NORMALISED note;
      `compileExtraction({ rolesOptional })` holds nothing for a role
      and records the role coverage FOUND, reason ROLE_IN_COMPONENTS;
      `validateAgreementDraft` skips the role check for a V10 call.
      Proven end to end on Concho 6.3 through the synthetic routing
      and a lean answer written the way the model would: the fact
      VALID with real span ids and the anchored words resolved
      (tests/product-cost-ablation.test.js). (c) The ablation
      harness, `scripts/product/cost-ablation.js`
      (`lib/product/cost-ablation.js`): one stored run's sections
      extracted again under a variant of the profile and the model
      (the ladder baseline, format, anchors, lean, lean_medium,
      lean_opus55, lean_opus55_medium, routing_sonnet, routing_haiku),
      routing and residual answered from the stored calls, only the
      extraction live (every answer recorded for replay), the stored
      VALID facts matched to the variant's on the bytes by
      generation-comparison's rule, tokens, seconds and dollars beside
      them, the stored row repriced at Opus 5.5; the baseline row is
      free. The three sections: 3.19 (seven facts, $1.31 as stored),
      5.2 (27, $3.43), 5.17 (41, $4.98); the six extraction variants
      about $45 together, the two routing variants under $1 (the
      note's section 12 has the commands). (d) Concurrency: the parts
      of a split section go out together up to
      PRODUCT_EXTRACTION_PART_CONCURRENCY (1 unless set, the serial
      order so far; the LONG_SECTION_SPLIT issue records it;
      `mapWithConcurrency` keeps part order and lets a failed part's
      siblings finish recording), and the hosted worker takes
      `--workers` 1 to 8 (launch.sh reads PRODUCT_HOSTED_WORKERS, 2
      unless set). (e) The gate (item 5): `runCostMetrics` per run
      (cost a VALID fact, input and output tokens an agreement byte,
      output tokens a fact, call minutes and calls a section, sends a
      byte, the failed and uncommitted cost) against the NCS
      generation 5 baseline fixture; `extraction-cost-ledger.js
      --baseline` exits 3 on a rise over the tolerance unless
      `--explain metric=reason` names the plan finding that accepted
      it; tests/product-extraction-cost-ledger.test.js holds the rule
      and the baseline. Asked of the manager, in order: (1) the proof,
      `node scripts/product/replay-run.js --run
      51577c57-41b1-4b75-bcdf-c84ef2558589 --out ncs5-replay.json`
      where SUPABASE_URL names the preview branch, expected "identical
      by proposal id and status" with 1,015 VALID and 22 held and
      zero calls (a difference is a rule merged after the wake,
      finding (94) and work package 19, and is the fix under test;
      read it); (2) `extraction-cost-ledger.js --run` on both runs,
      the two outputs beside the note; (3) the ablation snapshot
      (`cost-ablation.js --run ... --sections 3.19,5.2,5.17
      --dump-snapshot`) and the baseline variant, then the live ladder
      at about $46 of Ben's credit on your word; (4) the console's
      billed usage for the workspace over 13:27 to 20:47 UTC and the
      workspace's output-tokens-per-minute limit for claude-opus-5
      (eight loops need 42,000 a minute). Nothing in the LEAN config
      is the default: V9 runs exactly as before until the ablation
      table says which rungs hold.
      Tests: tests/product-run-replay.test.js,
      tests/product-lean-request-profile.test.js,
      tests/product-cost-ablation.test.js, added to test:active
      beside the ledger suite; tests/product-hosted-worker-pool.test.js
      takes the new worker range. npm run test:active on the merged tree
      of (182)'s push: 792 tests, 791 pass, the one failure the known
      Codex-client final-message test.

      (182) 2026-10-19 00:40 to 01:30 UTC (implementer E), the manager's
      direction of 2026-10-18 22:30 UTC (finding (180) accepted; the
      console figure "log not avail yet", the reconciliation line stays
      pending) reconciled with (181), which was built on the brief's
      terms before the direction arrived. Held as built: evidence_quotes
      dropped where the components carry the words, the V1 roles dropped
      from the request (finalisation checked first: a V10 call's
      proposals skip the role check, the legacy-role note of finding
      (65) untouched for V9 runs), span ids as a per-call alias table
      (s1..sn) expanded before the compiler reads the answer, one
      stable block that never changes per run plus the routed one, the
      cached agreement, concurrency beyond two loops, the failed-attempt
      and idle count (item 3: $13.84 and 69 call-minutes lost, every
      cause fixed before this package by findings (74), (77), (81),
      (83) and (87), the gate's uncommitted_attempt_cost_usd holds it at
      zero). Added on the direction, each a request-profile setting and
      a rung of the ladder, none the LEAN config's until the table says
      it holds: `quote_mode: 'offsets'` (quote_offsets, the zero-based
      character offsets of a component's words within the cited span's
      exact_text; `resolveOffsetQuote` reads the words from the span, so
      the verbatim check downstream is the span's own; the request and
      answer contract are this package's, the validator's own
      acceptance of offsets is implementer A's work package 21, to be
      coordinated through the findings, not by editing each other's
      files), `contracts_scope: 'all'` (every family's contracts and
      table shapes in every extraction call's stable block with
      `routed_families` named, the answer's allowed families, fact types
      and subtypes still the routed ones: one stable block per call
      kind for the run instead of 51), `context_mode: 'trimmed'`
      (cross-references one hop deep, the sections the section's own
      words name by "Section 5.2", "Article VI" or "Annex A",
      `directlyReferencedNodeIds`, each whole and once, the rest listed
      by section and first words). The thinking share measured, not
      assumed: on a live call the visible answer's tokens are counted
      by the API's own tokenizer (`count_tokens`, not billed) and taken
      from the output tokens, per call and per section (`thinkingOf`;
      the table shows "thinking N of M output (x%)"). The proof script
      is `scripts/product/cost-ablation.js` (`lib/product/cost-ablation.js`;
      renamed from section-ablation in (181)), built to run inside a
      hosted worker sandbox through `createAnthropicApiProductModel`
      (the sandbox holds the key at wake; no session reads it), the
      three sections' stored closures, calls, work rows, proposals and
      components from a snapshot file (`--run ... --dump-snapshot`),
      one variant per `--variant` flag, and `--analysis-dir` writing
      `stored.analysis.json` and `<variant>.analysis.json` in the
      analysis read's shape for `compare-generations.js --v1-file
      --v2-file` beside its own byte-matched table. The ladder is now
      baseline, format, anchors, offsets, all_contracts, trimmed, lean,
      lean_medium, lean_opus55, lean_opus55_medium, routing_sonnet,
      routing_haiku; the nine extraction variants about $65 at the three
      sections' size, the two routing variants under $1; the manager
      chooses the rungs. Rate limits, from the platform's page through
      the claude-api skill's live sources (not memory): `claude-opus-5`
      has its own bucket, 400,000 output tokens a minute and 2,000,000
      uncached input tokens a minute on the Start tier (1,000,000 and
      5,000,000 on Build, 2,000,000 and 10,000,000 on Scale; cache reads
      do not count towards input), so eight loops at 42,000 output
      tokens a minute are a tenth of the Start tier and the sandbox and
      the store's leases bound the concurrency, not the API; an
      organisation new to the API may sit below Start until it has a
      history, which the console's Rate limits page shows. Proven here
      on Concho 6.3 through the synthetic routing: offsets resolved
      from the span, every family's contract in the request with the
      answer bound to NO_SHOP, the trimmed closure keeping the named
      sections whole, the fact VALID
      (tests/product-cost-ablation.test.js). Also in this push: the
      recorded adapter's key tolerates an input without a prompt
      version (the Modiv calibration's recordings; the active suite's
      Modiv test failed on the first form of (181)'s callKey), and the
      hosted worker's two tests take the one-to-eight range.

      (183) 2026-10-19 02:55 to 04:30 UTC (implementer E), work package
      E2, the ablation through the wake path. No run submitted, woken
      or retried; no live call; no sandbox touched; no key read. (a)
      The job: `POST /api/product/ablation`
      (`lib/product/ablation-handler.js`, a sibling of the run route;
      `scripts/product-hosted-worker.js` and the run route untouched,
      implementer D's), opened by the internal bearer token alone (a
      browser session is refused: the job spends subscription capacity
      on purpose), with `{ run_id, sections, variants, sandbox_name?,
      provider? }`; `wakeSandboxAblation` (lib/product/sandbox-wake.js)
      resumes the experiments sandbox `pm-codex-preview-worker-3`
      (`ABLATION_SANDBOX_NAME`, outside the run pool so no run is ever
      placed on it; the create and update scripts take it by `--name`),
      gives its session MINIMUM_SESSION_MS, and runs
      `infra/codex-sandbox-worker/ablation-launch.sh` detached with the
      job id (`pm-ablation-<timestamp>`), the run id, the sections and
      the variants as arguments and the same environment a run wake
      passes (the preview database URL and key, PRODUCT_MODEL_PROVIDER,
      the CLI's OAuth token or the API key; the launcher's own checks,
      its own lock /vercel/.codex/pm-ablation.lock). The launcher dumps
      the snapshot on the sandbox from the database and runs
      `cost-ablation.js --live --provider <the wake's>`, writing
      job.log, ablation-rows.json, ablation.md, ablation.json,
      ablation-recording.json, analysis/ (for compare-generations) and
      exit-code under /vercel/sandbox/<job id>/ and nothing to the
      product tables. (b) `{ status: true, job_id? }` runs a fixed
      status shell on the sandbox (`ablationStatusScript`, the job id
      validated to its pattern, nothing else variable) and returns the
      job directory, the jobs present, RUNNING / DONE / FAILED /
      NOT_FOUND, the exit code, the log tail (12,000 bytes) and the
      table once written. Errors answer as the run route's do (a gone
      sandbox 503 naming it, a missing credential 503 with the code in
      the deployment log, a bad body 400 with the code). (c) The CLI
      path of cost-ablation.js: `--provider` (PRODUCT_MODEL_PROVIDER as
      the wake passes it, else the API) builds
      `createClaudeCliProductModel({ callKindModels })`, the variant's
      models through the CLI's --model and --effort (the one addition
      to lib/product/claude-cli-model.js; a run never passes it);
      `variantAvailability` says what the CLI can express: the lean*
      rungs' agreement block is an API cache breakpoint the CLI does
      not control, so they are listed as not run in the table, the json
      and the script's first line, never faked; a two-block rung sends
      the same words with the note that the cache split reported is
      the CLI's own; the CLI-expressible model rungs added are
      anchors_medium, anchors_opus55 and anchors_opus55_medium (the
      lean_* tier changes on the inline context). On the CLI the
      thinking share is what the CLI reports per call
      (usage.output_tokens_details.thinking_tokens, read from Metsera
      generation 8's stored calls: 5,041 of 10,208 on one 96-second
      extraction), the list-price cost its model_usage costUSD, the
      seconds its duration_api_ms; the table says "reported" or
      "count_tokens" beside every thinking figure and "thinking not
      reported" when neither. (d) Proven on the phase-1 fixture
      (tests/product-ablation-wake.test.js, 6 tests): the fixture
      through the pipeline on a synthetic model as the stored run (one
      VALID termination fact in 3.1 with its component bytes); the CLI
      path on baseline, format, lean and routing_haiku through a fake
      `claude -p` client (format: one live extraction on
      claude-opus-5 at high effort, the fact matched on the bytes, the
      CLI's thinking, cache reads and list cost in the row; lean: not
      run, listed; routing_haiku: routing and residual on
      claude-haiku-5-5 at low effort through --model, the routing
      agreed and the extraction replayed from the stored call); then
      the same ladder from the recording through
      `createRecordedModelAdapter` with the fake CLI never called and
      the recording exhausted, the same fact by occurrence and bytes;
      the script's main from a snapshot and a recording on the CLI
      provider writing ablation.md ("Not expressible on this provider,
      listed and not run: lean"), ablation.json and the three analysis
      files; the wake's exact command (launcher, arguments, the run
      wake's environment, no secret in the answer) and its refusals
      (an unknown sandbox, a shell character in a section, a wrong
      variant name, a missing credential, the production database);
      the status shell and its parse; the route's 401 without the
      bearer, 202 with the job, the API's key when named and the CLI's
      token otherwise, 400s, 503s, 405. For the manager, in order: (1)
      create the experiments sandbox,
      `node scripts/product/create-sandbox-worker.js --provider
      ANTHROPIC_CLAUDE_CLI_SUBSCRIPTION --name pm-codex-preview-worker-3`
      (the branch tip after this push; the launcher is in the
      checkout); (2) the job, the two curl lines in the note's section
      12 (the twelve variants in the order given; the CLI lists lean as
      not run); (3) `{status:true}` until DONE, then send the table and
      the json; `analysis/` is there for compare-generations when
      wanted. Known limits: one job at a time per sandbox (the lock;
      a second wake waits up to an hour); a job runs as long as the
      session the wake gave it (four hours; the twelve variants on
      three sections are well inside); the route reads no database
      and does not check the run exists, the job's first log line
      says so if it does not.
      Tests: tests/product-ablation-wake.test.js, added to test:active;
      tests/product-sandbox-worker-scripts.test.js takes the
      experiments sandbox; tests/product-cost-ablation.test.js takes
      the thinking source. npm run test:active before the merge of
      origin: 804 tests, 803 pass, the one failure the known
      Codex-client final-message test.

      (184) 2026-10-19 03:05 to 05:10 UTC (implementer E), work package
      E3 part 1, on Ben's brief (finding (177), verbatim: "I'd push e
      again to say it should imagine itself like a nasa engineer in
      Apollo 13, having to figure out how to get all required
      performance on even less juice and even quicker. It can
      experiment, tear up ideas etc. cone at completely fresh. And be
      implanting its existing ideas now too") and the manager's message
      of 03:05 UTC. The existing ideas implanted: the stack that needs
      no proof is the default request profile for every new run on
      both hosted providers, behind the model-config identity.
      `REQUEST_PROFILES.DEFAULT` (lib/product/product-model-config.js):
      the V10 answer with span aliases and anchored quotes, every
      family's contracts in two stable blocks (one per call kind for
      the run), the context inline. Two new configs carry it:
      `PRODUCT_ANTHROPIC_API_CALL_KIND_MAP/V3` (routing and residual on
      claude-haiku-5-5 at low effort, extraction on claude-opus-5-5 at
      high: the claude-api reference's model table lists it Active with
      the same 1M context and 128K output, and the pricing table at
      $4 / $20) and `PRODUCT_CLAUDE_CLI_CALL_KIND_MAP/V2` (Haiku
      routing and residual, Opus 5 extraction: the subscription CLI's
      model list is the subscription's, not the reference's, so Opus
      5.5 waits there for the ablation's anchors_opus55 rung on the
      third sandbox; one constant changes it). Medium effort and the
      cached agreement wait for the ablation. A new run takes the
      default (`configuredProductModelConfig`, `hostedModelConfigFor`
      without a run, the intake either way); a run created under V1 or
      the lean config advances under it (`hostedModelConfigFor(provider,
      run)` follows the stored config by identity among the known
      configs per provider; the worker's assertConfiguredRunModelConfig
      passes the run under its own config and refuses the fresh one;
      `resolveClaudeCliCallModel` and `resolveAnthropicApiCallModel`
      read the known config's own call-kind map); the paused and
      finished runs keep theirs. `PRODUCT_REQUEST_PROFILE=V9` restores
      the earlier configs for new runs; `PRODUCT_ANTHROPIC_API_PROFILE`
      still wins for the API. The launcher runs eight section loops
      unless PRODUCT_HOSTED_WORKERS says otherwise
      (infra/codex-sandbox-worker/launch.sh; scripts/product-hosted-worker.js
      untouched, implementer D's) and a split section's parts go out
      four at a time (PART_CONCURRENCY_DEFAULT in agreement-draft.js;
      at most 32 streams, 167,000 output tokens a minute against the
      Start tier's 400,000). Nothing on uncommitted attempts is D's
      attempt resume (7c998af) and the gate's
      uncommitted_attempt_cost_usd. The gate: the projected baseline
      tests/fixtures/product/run-cost-baseline.default-profile.projected.json
      by the ledger's method, until the first run under the default
      measures it (extraction-cost-ledger.js --run replaces it). NCS
      generation 6 on the default, by the ledger's method (the note's
      section 13): output 2.34m tokens at $20 ($46.8), fresh input
      5.42m at $4 ($21.7), one stable block per call kind ($2.0),
      reads ($1.1), Haiku routing and residual ($0.5): about $72
      against $145.68, $0.07 a VALID fact; 448 call-minutes, about 70
      wall minutes at eight loops with the parts together against 439;
      on the CLI $0 and the same time. Proven: the configs and the
      identity follow on both providers, the intake's choice, the
      environment's V9 switch, Concho 6.3 under the default as one V10
      request with every family's contracts in the second stable block
      and the answer bound to the routed family, the fact VALID with
      the anchored words resolved
      (tests/product-default-request-profile.test.js, 3 tests);
      tests/product-anthropic-api-provider.test.js,
      tests/product-claude-cli-provider.test.js and
      tests/product-lean-request-profile.test.js take the new default
      and the identity follow. npm run test:active on a clean checkout
      of the commit: 829 tests, 827 pass; the known Codex-client
      final-message test, and a wall-clock timing test
      (canonical-v2-sec-html-canonical-text, "without per-region
      full-document scans") that ran while two suites shared the
      machine and passes alone, 13 of 13. Part 2, the fresh sheet
      (every assumption of the pipeline questioned, the deterministic
      experiments behind flags), is finding (185).

      (185) 2026-10-19 05:10 to 06:30 UTC (implementer E), work package
      E3 part 2, the fresh sheet (Ben, finding (177): "It can
      experiment, tear up ideas etc. cone at completely fresh"). No run
      submitted or woken; no live call. The sheet is section 14 of the
      ledger note: eleven assumptions the pipeline carries, each with
      the experiment the ablation job runs (a rung), the saving by the
      ledger's method against the default's projected $72 and 70
      minutes, and what it risks; built where no new model behaviour
      is needed, designed where the build is the next step. Built in
      this push, behind request-profile flags (lib/product/agreement-draft.js),
      none the default's until the ablation says so: (1)
      `routing_mode: 'deterministic_first'`: where the deterministic
      evidence is all heading rules and anchoring defined terms
      (SECTION_FAMILY_RULE_CLASSIFIED, SECTION_FAMILY_DEFINED_TERM_ANCHORED;
      `deterministicRoutingDecision`), the routing is the code's and
      the routing call is not made; the residual pass and the
      compiler's widening stay; `compileRouting` records
      model_call_id null and routing_source DETERMINISTIC, the section
      carries a ROUTING_DETERMINISTIC note, the section's coverage has
      no call behind it. A limit, stated: product_section_routings'
      model_call_id is NOT NULL with a foreign key to the model calls
      (migration 20260905043000), so a hosted run cannot store a
      routing with no call yet; the rung runs in the ablation, which
      writes no store, and the step before a run takes the flag is a
      migration (a nullable model_call_id, or the routing row citing
      the residual call that did run), implementer D's table. On NCS,
      118 routing calls
      to about 40; $0.3 at Haiku and about 8 wall minutes, and one
      fewer thing to fail. (2) `definitions_scope: 'direct'`: the
      definitions whose defined term (the quoted term the paragraph
      opens with, `definedTermOf`) appears in the section's own words
      go whole, the transitive ones are listed by first words for the
      model to ask for by alias (`directDefinitionSpanIds`; a
      paragraph without a readable term goes whole, never lost). With
      `trimmed`, the 16.36 MB sent on NCS falls to about 7 MB: $11 of
      the $72. (3) `fact_budget: true`: the request carries the
      expected count and a ceiling from the section's operative bytes
      (one fact per 290 bytes on NCS generation 5, 1,015 over 295,516;
      `factBudgetFor`) as a check the instruction says is not a
      target; an answer past the ceiling is a FACT_BUDGET_EXCEEDED
      note, never a hold. (4) The ladder gains `default` (the new
      default's profile and models; on the CLI the rung that confirms
      Opus 5.5 there), `deterministic_routing` (no call: the stored
      answers route where the words do not, so the row says how many
      sections the words decide and whether the facts hold),
      `direct_definitions`, `fact_budget` and `anchors_sonnet55`
      (Sonnet 5.5 writing the facts: $36 of the $72 if the bytes
      hold). Designed, with their cost on the sheet: the residual skip
      where the words routed a one-paragraph section; the statement
      derived from the OWN components; facts as NDJSON lines so a cap
      costs a fact, not an attempt (5.1's three attempts); the Batch
      API's three waves (50 per cent); section batching for the thirty
      sections under 1,500 bytes. Stacked: the built rungs that hold
      take the default's $72 to about $55, the model tier and the
      Batch API to about $12, which with the subscription's $0 is the
      10x Ben named, the facts judged the same way at every step.
      Proven on Concho 6.3 through the synthetic routing
      (tests/product-fresh-sheet-experiments.test.js, 6 tests): the
      heading "No Solicitation" routes the section with no ROUTING
      call and the fact compiles VALID; the direct definitions keep
      the terms the section names and list the others; the budget is
      in the request and an answer past the ceiling is a note while
      the facts are still compiled; the rungs run on the CLI. For the
      manager: the third sandbox's ladder, in the order the money
      goes: default, deterministic_routing (free), direct_definitions,
      fact_budget, anchors_sonnet55, offsets, trimmed; each with
      `--analysis-dir` to compare-generations. npm run test:active on
      a clean checkout of the commit: 835 tests, 834 pass, the one
      failure the known Codex-client final-message test.

      (186) 2026-10-19 04:50 to 05:40 UTC (implementer E), the manager's
      two items from the first ladder's log (job
      pm-ablation-20261019T040851Z on the experiments sandbox; nothing
      run here, the manager runs the ladder again after this push).
      (1) The replay rungs missed on byte identity (baseline on all
      three sections, deterministic_routing on all three): the
      ablation's replay now answers loosely, as replay-run.js does
      (lib/product/cost-ablation.js createVariantModel, match 'loose'
      by default): the stored call of the same section, kind and part
      answers, and the row lists the drift ("replayed (2 answered
      loosely: RESIDUAL, EXTRACTION part 1)"); an exact hit is a replay
      with no note; a miss is only a section the stored run never
      called. So the baseline row is the stored answer re-compiled by
      today's code and the deterministic_routing row the stored
      extraction with the routing replaced, as asked. (2) The 227,287
      input tokens on direct_definitions' 5.17 extraction (505
      seconds, 23,521 output of which 15,374 thinking) are the CLI's
      own accounting of a block the API caches, not the rung sending
      more than it should. Measured here with the real table shapes
      (Concho 6.3 under the DEFAULT profile, cacheableContent): the
      two stable blocks are 387 KB, table_shapes 213 KB and
      family_contracts 143 KB of it, about 143,000 tokens at the
      ledger's 2.7 bytes a token, against 63 KB (about 23,000 tokens)
      with the routed families' contracts; the section block for 5.17
      is the rest, about 84,000 tokens, which direct_definitions
      trimmed as designed. On the API the stable blocks are written
      once a run and read at $0.20 a million on every call; `claude -p`
      sends and counts them fresh on every call (ledger section 4:
      Metsera wrote 9.7m and read 0.59m). By the ledger's method the
      same call on the API is $0.84 (84,000 fresh at $4, $0.34;
      143,000 read, $0.03, plus one write a run, $1.15; 23,521 output
      at $20, $0.47); at the fresh rate the CLI's count implies it
      would be $1.38; on the subscription it is $0 but it is 143,000
      tokens of the subscription's capacity per extraction call, about
      15m tokens a run, and the CLI's prompt time. The thinking share
      on that call, 65 per cent, is the CLI's report (the API path's
      assumed 36 is Metsera's average; a long section at high effort
      thinks more). Done about it, in code: the CLI's default config
      now carries REQUEST_PROFILES.DEFAULT_CLI, the DEFAULT request
      with the routed families' contracts (`PRODUCT_CLAUDE_CLI_CALL_KIND_MAP/V2`
      keeps its id: no run was created under it between the two
      pushes; the identity is the whole config, so a run created from
      now on carries DEFAULT_CLI), and the ladder runs a rung whose
      profile says contracts_scope 'all' with the routed contracts on
      the CLI (`profileForProvider`, the row's profile column says so;
      the API keeps the all-families block). The projected baseline's
      cache-write line (0.25m tokens a run) stands corrected by this
      measurement to about 0.15m written once per extraction block
      plus the routing and residual blocks, $1.2 a run at $8 a million;
      the projected total is unchanged to the dollar. Tests:
      tests/product-cost-ablation.test.js (the loose replay and its
      drift, the exact mode still missing),
      tests/product-default-request-profile.test.js and
      tests/product-fresh-sheet-experiments.test.js (DEFAULT_CLI, the
      per-provider profile), tests/product-lean-request-profile.test.js.
      npm run test:active on a clean checkout of the commit: 835 tests,
      834 pass, the one failure the known Codex-client final-message
      test.

      (187) 2026-10-19 06:45 to 07:40 UTC (implementer E), work package
      E4: the first ladder's defects (the manager's note
      docs/codex-program/notes/ABLATION-LADDER-RUN-1-2026-10-19.md,
      finding (210)), fixed before the second run; nothing run here.
      (1) The recording key carried the request alone, so anchors,
      anchors_medium, anchors_opus55 and anchors_opus55_medium all
      replayed anchors_sonnet55's answers and all_contracts replayed
      direct_definitions and default. The key is now the call key with
      the model, the effort and the profile identity
      (`recordingKey`, lib/product/cost-ablation.js; the entry carries
      model, effort and profile), a hit is checked against the entry's
      own model id, an entry of an older recording (call_key alone) is
      never loaded, and the selection a rung runs each call kind on is
      the variant's own else the provider's default map (the CLI's V1,
      the API config's). Pinned: two rungs sharing a recorder that
      differ in model, in effort or in profile never reuse each other's
      answers; the same model and effort again reads the recording; a
      legacy entry answers nothing; an entry whose model id disagrees
      with the key is refused (tests/product-cost-ablation.test.js).
      (2) The cost and thinking columns summed the whole recording
      across the ladder ("thinking 468,406 of 116,466 output", "at
      list $63.03"): a rung's per-section figures now come from the
      entries that answered that rung's own calls (`model.answered`,
      live or from the recording), never the recorder's store; pinned
      with two rungs in the same test (each rung's answered list holds
      its own entries, the list cost and thinking share per rung).
      (3) The one fact trimmed and direct_definitions each lose on
      5.17: this session cannot read the job's analysis files
      (/vercel/sandbox/pm-ablation-20261019T040851Z/analysis/
      trimmed.analysis.json and direct_definitions.analysis.json
      against stored.analysis.json; the manager is asked for those two
      pairs through compare-generations for finding (188)), so the
      mechanism is read from the rows: trimmed's 5.17 row has two
      unresolved anchors and two held facts, direct_definitions' one
      held, and both list spans the model never saw whole (a
      cross-reference one hop away, a transitive definition). A
      component that cites a listed span with anchors or a quote the
      span does not hold cannot resolve, and the fact is held. The rule
      that brings it back, built: `normaliseLeanResponse` takes the
      listed span ids (`listedClosureSpanIds`, the same rules as the
      request) and resolves such a component to the whole listed span
      (its words are the span's), counted as listed_spans_resolved in
      the section's LEAN_RESPONSE_NORMALISED note; a quote the span
      does hold stays as written, an OWN span is untouched. Whether
      that is the fact in question, the second run's rows say (the
      count will be non-zero on 5.17 and the match 41 of 41 if so).
      (4) The CLI's stable-block accounting on 5.17: default wrote
      1,133,208 tokens over five calls, the routed-contracts rows
      381,943 (anchors_sonnet55), 381,688 (offsets) and 381,138
      (format); the difference, 751,265 over five calls, is 150,253
      tokens a call for the all-families block, against the 143,000
      measured on Concho with the real table shapes (finding (186)).
      DEFAULT_CLI (the routed contracts, anchors, inline) sends the
      routed-contracts rows' blocks, so its 5.17 figure by the ledger's
      method is about 382,000 written, 76,400 a call, a third of
      default's on the CLI; on the API the same five calls under the
      all-families default are 150,000 read at $0.20 ($0.15) plus one
      write a run, about 53,000 fresh a call at $4 ($1.06) and the
      113,610 output at $20 ($2.27), about $3.50 for 5.17 against the
      stored $4.85. Also read from the table, for the record: Haiku's
      routing differed from the stored Opus routing on 3.19
      (MATERIAL_CONTRACTS added, MAE_DEFINITION dropped) and 5.17
      (CONSIDERATION dropped) and the facts still matched 7 of 7 and
      41 of 41, because the compiler's widening and the extraction's
      coverage carry the families the words name; the second run's
      routing_haiku row measures that on its own. Tests:
      tests/product-cost-ablation.test.js (6),
      tests/product-fresh-sheet-experiments.test.js (7),
      tests/product-lean-request-profile.test.js. npm run test:active
      on a clean checkout of the commit: 836 tests, 835 pass, the one
      failure the known Codex-client final-message test.

      (188) 2026-10-19 07:45 to 08:40 UTC (implementer E), the two 5.17
      comparison pairs (docs/codex-program/notes/ablation-run-1/
      compare-stored-vs-trimmed.md and
      compare-stored-vs-direct_definitions.md) read, with the stored
      run's rows for the two facts (product_fact_components, read-only
      SQL; nothing run). Two different facts are lost, not one: trimmed
      loses the GENERAL_NOTIFICATION fact "The Registration Statement
      (or any prospectus or prospectus supplement forming a part of such
      Registration Statement), as initially filed, shall include the
      Registrable Securities of the Specified Stockholders ... subject
      to receipt of information reasonably requested by Parent
      necessary to complete such prospectus supplement" (V2 held
      "Registration Statement as initially filed includes the
      Specified Stockholders' Registrable Securities" over its bytes;
      under direct_definitions the same fact matches at 77 per cent);
      direct_definitions loses "The aggregate amount which any such
      Specified Stockholder shall be required to pay pursuant to
      Section 5 ... the net proceeds actually received ... giving rise
      to such Claim" (V2 held "Specified Stockholder's liability capped
      at net proceeds received from sales under the registration
      statement" over its bytes). The stored run's components of both
      facts are OWN words on 5.17's own paragraph spans (the aggregate
      amount fact: EXCEPTION "provided, however", OBJECT, OPERATION
      "shall in no case be greater than", THRESHOLD; the Registration
      Statement fact: ACTOR, two OPERATIONs, CONDITION, and one
      DEFINED_TERM component on the "Specified Stockholders" definition
      at byte 290,582, a definition the section's own words name, so
      sent whole under both rungs). So (187)'s listed-span rule is not
      what brings either fact back: it touches a component that cites
      a span the request listed, and these cite none; pinned
      (tests/product-held-fact-issue-link.test.js, the rule leaves an
      own-span component as written and the fact stays held). The
      reason each was held is what the reports hide, and that is the
      second defect: "V2 held a fact over these bytes:" with nothing
      after the colon, because a hold raised while the proposal is
      compiled (a component whose words the span does not hold, a
      missing readout, a representation exception) names the proposal
      by client_ref in its message, before the proposal has an id, and
      the comparison reads a held fact's reason by proposal_id
      (generation-comparison.js issuesByProposal), so every held fact
      read "no issue code". Fixed at the source: compileExtraction
      fills the proposal id into such an issue once the proposal has
      one (`issueClientRef`: the message is the ref, or JSON with
      client_ref). Pinned with the lost fact's own words through the
      pipeline on a fixture agreement: the fact compiles VALID as
      written; with one component's words read wrong ("requested by
      the Company" for "requested by Parent") it is held, the hold
      carries the proposal id, and the comparison report names the
      code where it said "no issue code". The mechanism the rows point
      to for the real losses, to be confirmed by the codes the second
      run's reports will now show: trimmed's 5.17 row has two
      unresolved anchors (the model's first and last words not found
      in the span: a page footer in the words, or anchors chosen from
      the parenthetical), which is the Registration Statement fact's
      long ACTOR component "The Registration Statement (or any
      prospectus or prospectus supplement forming a part of such
      Registration Statement), as initially filed"; direct_definitions'
      row has none unresolved and one held, a hold of another kind (a
      duplicate occurrence over the same bytes as the new "liability
      capped" fact, or a component problem the validator names). If
      the codes say unresolved anchors, the fix is in the anchors'
      resolution (longer anchors, or the offsets A's work package 21
      accepts), not in the context; neither rung changes what the
      model reads for these two facts. Also from the reports, for the
      record: under trimmed 3.19 and 5.2 lose nothing (7 of 7, 27 of
      27) and 5.17's other 40 facts match; under direct_definitions the
      same. Tests: tests/product-held-fact-issue-link.test.js (2), added
      to test:active. npm run test:active on a clean checkout of the
      commit: 838 tests, 837 pass, the one failure the known
      Codex-client final-message test.

      (189) 2026-10-19 09:20 to 10:30 UTC (implementer E), work package
      E5 part 1: the second ladder's two defects and the full-agreement
      confirmation harness, ready and not started (the manager's note
      docs/codex-program/notes/ABLATION-LADDER-RUN-2-2026-10-19.md,
      finding (211)). Nothing run here; the default profile's model and
      effort unchanged, the tier decision being Ben's. (1) GROUP_FAMILY
      on deterministic_routing (5.17 part 1) and routing_haiku (5.17
      part 3): when the live routing differs from the stored run's, the
      stored extraction the loose replay answers with names families
      outside today's routed set, or its part's operative spans are not
      today's part's, and the compiler threw. `replayMisfit`
      (lib/product/cost-ablation.js) checks both before the replay
      answers; an unfit part is extracted live when the rung has a
      provider, the row says so ("extracted live because the stored
      call did not fit: part 3: the stored call's groups name
      CONSIDERATION outside today's routed families (...)"), and
      without a provider it is REPLAY_MISS naming the part and the
      group, never a compiler throw. Pinned: the same families and
      spans replay; another family or another grouping falls back live
      once and the fallback is on the row; offline it misses with the
      part and the group named (tests/product-cost-ablation.test.js).
      (2) The cost column followed the CLI's reported cache split, so
      anchors_opus55_medium read "$0.00 at list $0.42" only because
      anchors_opus55 had just sent the same words: every row now also
      carries the two fixed-layout list prices at the extraction
      model's published rates, every input token written at the
      one-hour rate and every input token read (`fixedLayoutPrices`,
      the columns "List, all written" and "List, all read"), the
      stored row too, and each rung ends with a totals row over its
      sections (`ablationTotals`: facts, matched / partial / unmatched
      / new, tokens, seconds, the CLI's cost and both prices). A rung
      that replays the extraction while its routing or residual ran
      live is marked "routing agreement only, facts replayed" on every
      row (`fact_evidence: false`), so nobody reads routing_sonnet's or
      routing_haiku's fact columns as fact evidence. (3) The
      full-agreement confirmation harness: `--sections all` (the
      script, the route body and the library expand it to every
      section the stored run has a closure for, in the run's order;
      the launcher's pattern already admits the word), the parts of a
      split section four at a time as the draft's default, the
      comparison per section and the whole-agreement totals row per
      rung in ablation.md, and `--estimate`, which prices the ladder in
      subscription tokens from the stored run's own extraction calls
      without a call (`estimateAblationTokens`: on the CLI a
      routed-contracts rung's input is about the stored run's whole
      input, fresh, read and written together, as run 2's anchors rows
      showed, 68,287 / 249,787 / 381,943 against the stored 67,733 /
      250,382 / 374,989; its output is the stored output times the
      rung's measured ratio, run 2: anchors 0.91, anchors_medium 0.50,
      anchors_opus55 0.93, anchors_opus55_medium 0.60, anchors_sonnet55
      0.73; an all-families rung adds the 150,000-token block to every
      call). The estimate for NCS generation 5 whole, by that method on
      the ledger's totals (12.79m input and 3.80m output tokens over
      157 extraction calls): anchors_opus55_medium about 12.8m input
      and 2.3m output tokens, 26,000 seconds of output serial, about
      55 minutes at eight loops; anchors_sonnet55 about 12.8m input and
      2.8m output, about 65 minutes; the two together about 25.6m input
      and 5.1m output tokens of the subscription's capacity and about
      two hours of the experiments sandbox; the chosen tier's
      fresh-sheet rungs (deterministic_routing replays the extraction
      and costs nothing; direct_definitions and fact_budget about 12m
      input and 2.3m output each) add about an hour each. The
      manager's exact figure comes from the sandbox:
      `cost-ablation.js --run 51577c57-41b1-4b75-bcdf-c84ef2558589
      --sections all --variant anchors_opus55_medium,anchors_sonnet55
      --estimate`, no call. To fire when Ben picks the tier and the
      manager says so: the route with `{"sections":["all"],"variants":
      [...]}` on the experiments sandbox, never the pool. Pinned:
      'all' runs every section of the phase-1 run as a zero-call
      baseline with the totals row; the estimate's arithmetic on the
      stored calls, a replay rung at zero, and the script's --estimate
      from a snapshot (tests/product-ablation-wake.test.js). Read from
      run 2 for the record, the manager's figures standing: Opus 5.5
      medium 73 / 1 / 1 of 75 at 60 per cent of the stored output
      tokens and 57 per cent of the seconds, its one loss a fact Ben's
      (167) cuts; Sonnet 5.5 high 73 / 2 / 0 at 73 and 54 per cent;
      Opus 5 medium's second loss the page-footer fact A's (202) now
      resolves. Part 2 of E5, the Apollo 13 levers with the largest
      headroom (every byte sent three or more times, the agreement
      written back twice, the Batch API for the API provider), is
      finding (190). Tests: tests/product-cost-ablation.test.js (9),
      tests/product-ablation-wake.test.js (7). npm run test:active: 839
      tests, 838 pass, the one known failure (Codex client final-message
      file).

      (190) 2026-10-19 09:35 to 10:40 UTC (implementer E), work package
      E5 part 2, the Apollo 13 levers with the largest headroom
      (finding (181): every byte sent three or more times, the
      agreement written back twice, the Batch API for the API
      provider), two built behind the lean profile's flags and the
      third designed; nothing run, the default profile's model and
      effort unchanged. (1) The agreement written back twice:
      `statement_mode: 'derived'` drops statement from the extraction
      contract and tells the model so; `normaliseLeanResponse` writes
      it from the OWN components' words in source order with an
      ellipsis at a gap (`statement_derived: true` on the proposal,
      `statements_derived` in the LEAN_RESPONSE_NORMALISED note), and a
      statement the model writes anyway is kept. Rung
      `derived_statement` (routing and residual replayed); the ledger's
      figure for the statement is 9 per cent of the answer, 0.2m output
      tokens and about $4 of the default's projected $72 on NCS, and
      the estimate's output factor is 0.91. (2) The section's words
      sent a third time: `residual_mode: 'in_extraction'` folds the
      residual question into the extraction call of a section that
      will go out as one call (`residual_paragraphs` by span id,
      `residual_instruction`, `paragraph_dispositions` in the
      contract); `compileResidualPass` reads the dispositions with the
      extraction call as the residual's call (a missing or short answer
      leaves the unanswered paragraphs UNRESOLVED_UNUSUAL_PROVISION as a
      silent residual always has), the routing widens after the
      extraction, and a family the residual names that the extraction
      was not asked for is UNRESOLVED on the section with a
      RESIDUAL_FAMILY_NOT_EXTRACTED coverage issue, never NOT_FOUND;
      the RESIDUAL_IN_EXTRACTION note carries the paragraphs, the
      number answered and the families widened after. A split section
      (its parts each see some paragraphs), an out-of-scope exhibit, an
      incomplete closure and a section routed to no family ask the
      residual on its own as before; the extraction is compiled against
      the families it was asked for. Rung `merged_residual` (routing
      replayed): the 118 residual calls' 0.31m input and 90k output
      tokens and two calls' latency off every unsplit section's
      critical path, against about 40 output tokens a paragraph on the
      extraction answer (estimate output factor 1.03 on the extraction
      calls; the residual calls' own tokens are the saving the
      estimate, which prices extraction calls, does not show). The
      measure for both is the ablation's byte match; the row for the
      merged residual also says how often a family arrives after the
      extraction. (3) The Batch API, designed in the ledger note's
      section 15 from the reference: three waves per run (routing,
      residual, extraction), each one batch of up to 100,000 requests
      or 256 MB, `custom_id` the invocation id the ledger already
      computes so a result maps to its work row without a new table,
      the batch id as the work rows' lease so a restarted worker
      resumes at `retrieve`, `canceled` and `expired` results re-queued
      to the next batch of their kind, the run's stop a `cancel`; 50
      per cent of list on every token, cache hits inside a batch
      best-effort so the price is taken without them; most batches
      within an hour, every one within 24. The default's $72 to $36;
      the time floor becomes the batch queue rather than the longest
      section's output. The change is the worker's
      (scripts/product-hosted-worker.js, implementer D's), and goes to
      D through this finding; the pipeline's requests need nothing
      new. Section 14 rows 2 and 6 are now built, row 9 points at
      section 15; the guide's fresh-sheet entry names the flags. Tests:
      tests/product-fresh-sheet-experiments.test.js (9: the derived
      statement from the OWN components on Concho 6.3, a gap and an
      inherited word in the derivation, the merged residual's two calls
      with the dispositions compiled as the residual pass, a family
      widened after the extraction UNRESOLVED, a split section keeping
      its residual call), tests/product-lean-request-profile.test.js
      (the stats gain statements_derived). npm run test:active: 841
      tests, 839 pass: the known Codex final-message failure, and the
      SEC repeated-region timing test, which failed with a second suite
      running beside it and passes alone (13 of 13), as in finding
      (186).

      (191) 2026-10-19 10:30 to 11:20 UTC (implementer E), work package
      E6 on Ben's tier decision ((212), "Sonnet makes sense"). (1) The
      two (190) levers now have Sonnet rungs, `derived_statement_sonnet55`
      and `merged_residual_sonnet55` (lib/product/cost-ablation.js):
      the same profile flags as their bases with claude-sonnet-5-5 at
      high effort writing the facts, the estimate's output factor
      Sonnet's measured 0.73 (runs 1 and 2) times the lever's (0.66 and
      0.75). (2) The estimate, by (189)'s method on the ledger's totals
      for NCS generation 5 (12.79m input and 3.80m output tokens over
      157 committed extraction calls; 87 output tokens a second, eight
      loops): anchors_sonnet55 about 12.8m input and 2.77m output
      tokens, 31,900 seconds of output serial, about 66 minutes;
      derived_statement_sonnet55 about 12.8m and 2.51m, about 60
      minutes; merged_residual_sonnet55 about 12.8m and 2.85m, about 68
      minutes; the three together about 38.4m input and 8.1m output
      tokens and about 3.2 hours of the experiments sandbox. Read
      against the five-hour window the implementers share:
      anchors_sonnet55 alone fits with margin; all three leave about an
      hour and three quarters, which is not margin, so this finding
      recommends the confirmation job first (`{"run_id":
      "51577c57-41b1-4b75-bcdf-c84ef2558589","sections":["all"],
      "variants":["anchors_sonnet55"]}` on the ablation route, the
      experiments sandbox by default) and the two Sonnet levers as a
      second job after it is DONE (`"variants":
      ["derived_statement_sonnet55","merged_residual_sonnet55"]`); the
      manager decides. Not done here, and why: this Claude Code
      environment cannot reach the deployment's database (its
      SUPABASE_SERVICE_ROLE_KEY answers "Legacy API keys are disabled";
      the Supabase connector on Ben's account sees no project holding
      product_model_calls) and holds neither the internal bearer, the
      Vercel sandbox credentials nor the CLI's OAuth token, so
      `cost-ablation.js --estimate` could not read the stored run and
      the route could not be called from here; the figures above are
      the (189) method on the recorded totals, and the sandbox's own
      estimate (the command in (189)) is the exact one. The job id is
      the manager's to report once fired; no run was submitted or
      woken, no live model call made. (3) The default change, prepared
      and not pushed, as the manager asked: on implementer E's local
      branch codex/e6-sonnet-default, commit 244acaa, its touched
      suites 61 of 61, a fourth API config
      (PRODUCT_ANTHROPIC_API_CALL_KIND_MAP/V4) and a third CLI config
      (PRODUCT_CLAUDE_CLI_CALL_KIND_MAP/V3) carrying claude-sonnet-5-5
      at high effort for EXTRACTION, Haiku 5.5 routing and residual as
      now, the DEFAULT and DEFAULT_CLI profiles, Ben's words verbatim in
      the code comment; V3 and V2 stay in the known lists so a run
      created under them advances under them (the config's identity is
      its content less the output cap). Projected for NCS generation 5
      under it, by the ledger's method (section 13 with Sonnet's
      prices, $2 / $10, cache write $4, read $0.20, and its measured
      0.73 of the output tokens): extraction output 1.71m tokens
      $17.1, fresh input 5.42m $10.8, cache writes $0.6, reads $1.1,
      routing and residual on Haiku $0.5: about $30 against the
      stored run's $145.68 and the Opus 5.5 default's projected $71;
      time 1.71m output tokens at 87 a second, 328 call-minutes, about
      40 wall minutes at eight loops against 439 (Sonnet's measured 54
      per cent of the seconds says the same); on the subscription CLI
      $0 and the same minutes. It becomes the default only when the
      manager reads the whole-agreement totals row and writes the
      decision into a finding; a lost fact a lawyer keeps goes to Ben
      by name. Tests: tests/product-fresh-sheet-experiments.test.js
      (10). npm run test:active: 842 tests, 841 pass, the one known
      failure.

      (192) 2026-10-19 11:35 to 12:40 UTC (implementer E), on the
      manager's leave while the confirmation job runs (job
      pm-ablation-20261019T112716Z, fired by the manager at 11:27 UTC;
      244acaa held, not pushed): the fresh sheet's row 7, `fact_lines`,
      built; nothing run, no live call. The measured failure behind it:
      NCS generation 5's 5.1 ran past the 64,000-token output cap three
      attempts running ($9.29, 47 call-minutes, finding (180)), each
      attempt's whole answer lost and the section re-split. Under
      `answer_mode: 'lines'` (a lean-profile flag, rung `fact_lines`)
      the model writes one JSON object per line: the proposals in
      source order, then the groups and links, then one coverage
      trailer carrying every other field (paragraph_dispositions among
      them). `lib/product/fact-lines.js` reads the lines (a line
      without its marker is read by its fields), drops a broken last
      line, derives a group the cut left unwritten from its proposal,
      and counts what it read in `answer_lines`. Both providers read
      lines when the request says so: the API's `max_tokens` stop and
      the CLI's second text block mark the answer truncated instead of
      failing the call, and a lines system prompt replaces the
      one-object prompt for that call. The draft then keeps the facts
      the whole lines carry and sends the operative spans after the
      last span those facts cite as one continuation call (the same
      request with those spans alone, `extraction_part.mode:
      'continuation'`, `continues_after_span_id`, and an instruction
      naming the cut), merging the two answers as a split section's
      parts merge; a `FACT_LINES_TRUNCATED` coverage issue names the
      lines kept, whether the trailer arrived, the span the cut fell in
      (a fact of its words after the cut is the one the review may
      miss) and the continuation's own count; a cut with no span after
      the last cited one, or a second cut on the continuation, is noted
      and left; a split section's parts do the same each. Without the
      flag nothing changes. What it buys: a cap costs one continuation
      call rather than an attempt and a re-split, on both providers;
      nothing on tokens. What the ladder must show before it is the
      default: that the model keeps whole lines and source order under
      the lines prompt (the reader's counts say so on every call) and
      that the byte match holds; the rung replays routing and residual
      and extracts live. Tests: tests/product-fact-lines.test.js (4:
      the reader whole, cut and noisy; the API provider's max_tokens
      answer returned with its lines and the object mode still
      failing; the CLI's two text blocks as a cut; Concho 6.3 under the
      flag with a cut first answer, the continuation over the spans
      after the cited one, two VALID facts and the note, and the
      section unchanged without the flag), registered in test:active.
      npm run test:active: 846 tests, 845 pass, the one known failure.

      (193) 2026-10-19 13:25 to 14:15 UTC (implementer E), work package
      E7 on the manager's interim of the confirmation job
      (pm-ablation-20261019T122404Z, the third launch, (215)): 19 of
      104 sections in 42 minutes, 5.17 whole lost to one
      CLAUDE_PRODUCT_JSON on part 3 of 5. Built, nothing run, the job
      untouched. (1) The ablation now retries as the pipeline's attempt
      would be retried: a section whose live call failed on a
      retryable provider error (`RETRYABLE_ABLATION_FAILURE` in
      lib/product/cost-ablation.js: the CLI's CLAUDE_PRODUCT_JSON,
      CLAUDE_PRODUCT_RESPONSE, CLAUDE_PRODUCT_COMPLETION and
      CLAUDE_OUTPUT_TRUNCATED, the API's JSON, response, truncation and
      refusal failures, MODEL_RESPONSE_SHAPE, EXTRACTION_DECLINED, or a
      message saying the response was not one JSON object or ran past
      the cap) is tried once more with the same request; the row
      carries `attempts` and `retried_after` and the table says "second
      attempt after CLAUDE_PRODUCT_JSON"; a second failure stays a
      failed row ("failed twice (second attempt after ...)"); a replay
      miss, a missing provider or a compiler rule on the content is not
      retried (the same answer would fail the same way). Both attempts'
      calls are counted in the section's usage; the job log carries a
      SECTION_RETRY event. (2) `loops`: `cost-ablation.js --loops N`
      (1 to 16; the route body `loops`, the wake's fifth launcher
      argument when more than one, `--loops` in ablation-launch.sh)
      runs N sections at once with the rows in the run's order; the
      default is 1, so a running job's shape is unchanged. The
      estimate's wall minutes are now at the loops asked (default 1):
      (189)'s 66 minutes for anchors_sonnet55 assumed the sandbox's
      eight loops, which the job never had; at one loop the same
      method gives about 530 minutes at 87 output tokens a second, and
      about 390 at the 119 a second Sonnet 5.5 measured on run 2; the
      manager's interim pace (19 sections in 42 minutes) says about
      four hours, the parts of a split section being the only
      parallelism. For the second job (the two Sonnet levers), `loops`
      of 4 by that pace is about an hour each rung, within the
      five-hour window with the first job's remainder; the number is
      the operator's, against the subscription's rate limit. (3) 5.17
      part 3: what Sonnet wrote is in the job's ablation-recording.json
      on the sandbox, which this session cannot read; the manager reads
      it after DONE. If it is a second text block or a cut, (192)'s
      lines reader (`answer_mode: 'lines'`, rung `fact_lines`) is the
      lever; if it is prose around the object, the retry of (1) is.
      Tests: tests/product-ablation-wake.test.js (9: the retry on
      CLAUDE_PRODUCT_JSON with the fact extracted on the second
      attempt and the note, the second failure as a failed row, an
      unknown failure not retried; loops 2 with two sections in flight
      and the rows in order, the estimate at 4 loops and at 1, the
      wake's fifth argument only above one, the route's loops and its
      400, the launcher's argument, the script's "min at 2 loops"),
      tests/product-cost-ablation.test.js (9). npm run test:active: 849
      tests, 848 pass, the one known failure.

      (194) 2026-10-19 15:50 to 16:40 UTC (implementer E), on the
      manager's two asks after the confirmation ((216); 244acaa held;
      the variance job pm-ablation-20261019T151819Z running, untouched).
      (1) What Sonnet wrote on 5.17 part 3 and 3.10 is not in the job's
      ablation-recording.json: the recorder remembers answered calls
      only (createRecorder.remember runs after a provider accepts the
      answer), and a rejected call's text travelled on the failure
      record that invokeModel hands onModelCall, which the ablation's
      row did not keep. From this push the row keeps it:
      `failed_calls` on every section (lib/product/cost-ablation.js
      `failedCallSummary`): the call kind and part, the failure code
      and message, the output tokens, the text's length, its text
      blocks and stop reason, whether it begins with JSON or with
      prose, the first 4,000 characters, and what (192)'s lines reader
      makes of it (`lines_reader`: lines, kept, malformed, trailer,
      broken last line, truncated, proposals), so the question "would
      the lines reader have read it" is answered on the row at failure
      time; the table's note says "the model wrote: EXTRACTION part 3
      of 5 CLAUDE_PRODUCT_JSON: 18,402 characters, begins with prose,
      lines reader keeps 0 of 1 lines" or "begins with JSON, lines
      reader keeps 11 of 12 lines (11 proposals, last line broken, no
      trailer)", and ablation.json carries the whole summary. For the
      DONE job the two texts are gone; the variance job started at
      7c82fea4, before this change, so its retries' first attempts are
      not kept either; the next job's are. Read-only access to the
      sandbox is still not this session's (the (191) reasons stand),
      so the recording and the job files are the manager's to read;
      with this change the reading is a jq over ablation.json's
      `failed_calls`. (2) The second job (derived_statement_sonnet55
      and merged_residual_sonnet55, sections all, loops 4) against the
      five-hour window, from the confirmation's own measurements rather
      than (189)'s assumptions: anchors_sonnet55 wrote 2,224,248 output
      tokens in 15,033 serial seconds (148 a second, not the 87 the
      ledger assumed) and took about 171 wall minutes at one loop (the
      parts of split sections being the only parallelism; wall 0.68 of
      serial). The derived statement writes 0.91 of that output
      (section 14 row 6), the merged residual 1.03 (the dispositions on
      the extraction answer, no residual call): about 2.02m and 2.29m
      output tokens, 13,700 and 15,500 serial seconds. At loops 4: by
      serial over four, about 57 and 65 minutes; by the job's pace over
      four, about 39 and 44 minutes; the (189) method at 87 tokens a
      second gives 121 and 137 minutes, the ceiling. So the job is
      about an hour and a half to two hours by the measured figures and
      at most about four and a quarter by the ceiling, within the
      five-hour window once the variance job (seven sections, two
      rungs, loops 3) is DONE; the subscription's output rate at four
      sections at once is the one figure no run has measured, and the
      job log's LIVE_CALL durations will. Tests:
      tests/product-ablation-wake.test.js (the retry test now asserts
      the failed call's text, shape and lines-reader reading on the
      row and in the table, and a cut JSON Lines answer the one-object
      reader rejected that the lines reader keeps one of two lines of).
      npm run test:active: 849 tests, 848 pass, the one known failure.

      (195) 2026-10-19 16:25 to 17:00 UTC (implementer E), the default
      changed on the manager's go (16:24 UTC, after A's (203) merged
      and the variance job read in (217)): the prepared commit 244acaa
      of (191) merged into the branch at bdf6688 (a merge commit, no
      history rewritten; the one conflict the guide's fresh-sheet line,
      resolved keeping both sides). Ben's decision (212), "Sonnet makes
      sense", verbatim in the code comment
      (lib/product/product-model-config.js). The default configs for
      new runs are now ANTHROPIC_API_SONNET_MODEL_CONFIG
      (PRODUCT_ANTHROPIC_API_CALL_KIND_MAP/V4) and
      CLAUDE_CLI_SONNET_MODEL_CONFIG (PRODUCT_CLAUDE_CLI_CALL_KIND_MAP/
      V3): claude-sonnet-5-5 at high effort for EXTRACTION, Haiku 5.5
      at low effort for ROUTING and RESIDUAL, the DEFAULT profile on
      the API and DEFAULT_CLI (routed contracts) on the CLI; the Opus
      configs V3 and V2 stay known by identity, so a run created under
      them advances under them, and PRODUCT_REQUEST_PROFILE=OPUS (or
      PRODUCT_ANTHROPIC_API_PROFILE=OPUS) names them for a new run; V9
      as before. Projected for NCS generation 5 under the new default,
      from the confirmation's own measurements ((216): every section
      on these words and this model): 2,224,248 extraction output
      tokens against the stored 3,473,680, 15,033 serial seconds
      against 39,968; at the pool worker's eight loops with the parts
      together, about 35 to 45 wall minutes against the stored run's
      439 (the output's 31 minutes serial over eight, the routing and
      residual calls on Haiku beside it, and the longest section's own
      output the floor); on the API about $41 on the stored run's own
      cache layout, between $24 (every input token a read) and $62
      (every one a one-hour write), against $133.64 as billed; by the
      ledger's projection method ((191), section 13 with Sonnet's
      prices) about $30 and 40 minutes; on the subscription CLI $0 and
      the same minutes. Facts, from (216) and (217): 931 of 971
      matched outright on the whole agreement, the holds the
      cross-reference form A's (203) now resolves, the five omissions
      the same on Opus 5.5 medium and a contract-instruction matter
      (A's work package 22 item 4). Not done here: the pool sandboxes
      are not touched (the paused deals' workers stay down until the
      manager updates the pool to this commit and runs the suite,
      (175)); the second job (derived_statement_sonnet55,
      merged_residual_sonnet55, sections all, loops 4) is the manager's
      to fire after the Opus 5.5 medium whole-agreement job
      pm-ablation-20261019T155504Z is DONE. Tests:
      tests/product-default-request-profile.test.js,
      tests/product-anthropic-api-provider.test.js,
      tests/product-lean-request-profile.test.js (the default's
      expectations moved to the Sonnet configs, the Opus ones kept by
      identity and by the name OPUS), tests/product-claude-cli-provider.test.js
      (the same). npm run test:active: 851 tests, 850 pass, the one
      known failure.

      (196) 2026-10-19 17:30 to 18:00 UTC (implementer E), on the
      manager's two reads while the second job runs
      (pm-ablation-20261019T171620Z, fired 17:16 UTC, loops 4, the
      (193) retry on; nothing run here, the sandbox untouched). (1)
      The 122404Z recording for 5.17 part 3 and 3.10: as (194) found,
      the recording holds answered calls only and the ablation's rows
      at that commit did not keep a rejected call's text, so what
      Sonnet wrote there is not recoverable from the job's files; from
      (194)'s commit every row keeps it (`failed_calls` with the lines
      reader's reading), and the second job's rows are the first that
      do. This session still cannot read the sandbox; the reading is
      the manager's. (2) A part with a tiny answer (5.1 parts 1 and 3
      on Opus 5.5 medium, (219): 2,079 and 4,429 output tokens against
      22,739 and 92,153 on the sibling parts, 17 facts lost whole, no
      call failed, nothing retried): proposed, not built, in the
      ledger note's section 16. On a fresh deal the floor has to come
      from the answer and the request, and three signals are already
      in hand: first, the residual pass's own dispositions, a
      paragraph inside the part's spans that the residual put in a
      routed family (KNOWN_FAMILY with family_keys) and that no fact of
      the part cites, two independent readers disagreeing, deal-free
      and naming the words; second, the uncited operative bytes, the
      share of the part's operative bytes in spans no component cites,
      with a floor in bytes and a share (noisy alone: a long limb that
      is one fact); third, the fact budget's floor, fewer than a
      quarter of `factBudgetFor`'s expected count on a part of 2,000
      bytes or more, as the row's note. The rule: a part the first or
      the second signal trips is a thin answer, not a failed attempt;
      the facts written are kept, the part is asked once more with an
      instruction naming the uncited spans and the residual's
      paragraphs, the answers merge as parts merge ((192)'s
      continuation shape), and a second thin answer records a
      THIN_PART_ANSWER coverage issue naming the paragraphs with the
      routed family's fact types UNRESOLVED for that part, never
      NOT_FOUND. One extra call on the parts that trip it; on NCS
      under Sonnet high none of 5.1's parts would have, under Opus 5.5
      medium two. Before building: the per-call output tokens, facts
      and uncited-byte share against operative bytes on the stored NCS
      calls, to see where healthy parts sit, and the ablation row
      carrying `uncited_operative_bytes` and
      `residual_paragraphs_uncited` per part from the next job, so the
      thresholds come from the sandbox's figures. No code in this
      push. npm run test:active: 851 tests, 850 pass, the one known
      failure.

      (197) 2026-10-21 21:05 to 22:00 UTC (implementer E), work package
      E8 on the manager's read of the second job ((219), (220):
      derived_statement_sonnet55 answered 96 of 104 sections, 818 / 14
      / 11 of 843 stored, 1,844,268 output tokens against the plain
      mode's 2,224,248 on 102, about 17 per cent fewer per section;
      eight sections failed after the retry where the plain mode lost
      two). The recording is the sandbox's, which this session cannot
      read, so the three kinds are traced from the failure sites and
      pinned on answers of the shapes the messages name; nothing run.
      All three were compiler shape checks that threw for the whole
      section on one proposal, and the lean normaliser
      (`normaliseLeanResponse`, lib/product/agreement-draft.js) now
      repairs the answer before any check sees it. (1)
      MODEL_RESPONSE_SHAPE proposal.statement (5.1, four parts): under
      statement_mode 'derived' the statement came from the OWN
      components' resolved words, and a proposal whose anchors did not
      resolve (anchors_unresolved) had none, so `requiredString` threw
      and the part, then the section, was lost. Now a lean answer
      without a statement always gets one, derived mode or not: the
      OWN words, else any resolved words, else the anchors the model
      wrote verbatim ("first words ... last words"; the validator holds
      the fact on its unresolved component, which is what the review
      should see), else the headline, else a placeholder that says so;
      the proposal carries statement_source and the note counts
      statements_fallback beside statements_derived. (2)
      MODEL_RESPONSE_SHAPE proposal.evidence_quotes[].source_span_id
      (5.17, 5.11, 3.15, 2.5, 3.13): the lean contract asks for no
      evidence quotes and the compiler derives them from the
      components, but a model that writes some anyway under another
      name (source_span, span_id, span; text for quote) or without a
      span reached `resolveEvidenceQuote`'s requiredString. Now each
      written entry is read by whatever name it gave (the alias
      mapped), an entry with no span or no words is dropped, and a
      proposal left with none takes its evidence from its components as
      before (evidence_repaired, evidence_dropped in the note). (3)
      FACT_LINK_ENDPOINT p3c1:p3 (4.12), p2c1:p2 (3.3): a link endpoint
      naming a component ("p3c1") rather than its proposal ("p3"). Now
      an endpoint is read as the proposal that owns the component (by
      the component's ref, else by the proposal ref the name begins
      with followed by c and digits); an endpoint that is neither drops
      the link (links_dropped), never the section; cross-section links
      the same. The compiler's checks are unchanged, so an answer that
      reaches them under the V9 contract fails as before. Measured in
      the job: the derived mode writes about a sixth less output per
      section than the plain mode with the same facts matched on the
      sections that answered, the omissions the same five ((217)) plus
      III-INTRO's three and one on 6.1. Tests:
      tests/product-lean-answer-repairs.test.js (3, on Concho 6.3: the
      unresolved-anchors answer with no statement compiling whole and
      held, and the same across a split into parts; the evidence quotes
      under span_id and text repaired and the span-less one dropped,
      the fact VALID; the component-ref link read as its proposal and
      the link to nothing dropped, with the prefix form and
      cross-section links in the normaliser), registered in
      test:active; tests/product-lean-request-profile.test.js (the
      stats' new keys). Ready for the manager to update the sandbox and
      re-fire both levers on every section, four at once. npm run
      test:active: 854 tests, 853 pass, the one known failure.

      (198) 2026-10-21 22:30 to 23:10 UTC (implementer E), on the
      manager's interim of the levers' re-run
      (pm-ablation-20261021T213656Z, loops 4, (197) on the sandbox):
      derived_statement_sonnet55 failed 3.2, 8.3, 5.17 and 5.19 after
      the retry, all MODEL_RESPONSE_SHAPE
      proposal.evidence_quotes[].source_span_id again, so (197)'s
      evidence-quote repair did not reach the path. Traced from the
      code (the sandbox's recording is still not this session's to
      read): the label is the evidence quote's, the raise is the
      components'. `compileProposalComponents` resolves every
      component that names words through `resolveEvidenceQuote`, whose
      first line is `requiredString(source_span_id, 'proposal.
      evidence_quotes[].source_span_id')`; a component without a
      string span id, a child the model left without one (inheriting
      its parent's in the model's mind), a span under another name
      (span_id, source_span, span) or as a number, throws for the whole
      section. The derived mode asks for every operative word in the
      components, so it writes more children than the plain mode and
      trips this more often (five sections in the first run, four in
      this one; the plain mode's confirmation lost two to it as well:
      3.10's "proposal.client_ref" was the same kind of shape loss).
      Now the lean normaliser repairs the components before anything
      else: a span by any name, a number as its string, the alias
      mapped (component_spans_repaired); a child without a span
      inherits its nearest ancestor's, a top-level component without
      one the first span the proposal cites (component_spans_inherited);
      a proposal that cites no span at all is dropped with its ref in
      the LEAN_RESPONSE_NORMALISED note (proposals_dropped,
      dropped_proposals) and its links go with it, so the other facts
      of the section compile and the review sees the loss by name,
      never a failed section. The compiler is unchanged. Pinned on
      Concho 6.3: a top-level component under span_id with a span-less
      child and a second proposal citing no span, the section compiling
      with one VALID fact, the child kept on its parent's span, the
      dropped ref in the note; and a numeric id with span-less children
      in the normaliser. Tests: tests/product-lean-answer-repairs.test.js
      (4), tests/product-lean-request-profile.test.js (the stats' new
      keys). Ready for the manager to update the sandbox and re-fire
      after this job ends. npm run test:active: 855 tests, 854 pass,
      the one known failure.

      (199) 2026-10-22 01:55 to 03:00 UTC (implementer E), work package
      E9: the thin-answer guard of (196) built, on the manager's read
      of the levers' re-run ((221): both levers 50 / 1 / 15 of 66 on
      5.1 where the plain mode held 63 / 3 / 0, and the two article
      introductions lost whole; nothing run here). `thinAnswerSignals`
      (lib/product/agreement-draft.js) reads a part's, or an unsplit
      section's, answer against its request: the operative bytes in
      spans no component or evidence quote cites (the cited spans'
      byte ranges against the part's spans), the residual pass's
      KNOWN_FAMILY paragraphs in a routed family inside the part that
      nothing cites, the proposals against `factBudgetFor`'s expected
      count, and the call's output tokens against the bytes. Thin when
      a residual paragraph is uncited, or the uncited bytes are 1,500
      or more and over half the part, or (on a part of 2,000 bytes or
      more) the proposals are under a quarter of the expected count and
      the output under half a token a byte (`THIN_ANSWER`; NCS 5.1's
      healthy parts wrote two to nine tokens a byte with the thinking,
      the thin ones a fifth). The first thin answer of a section is a
      failed attempt: the draft throws THIN_ANSWER with the signals,
      the part named on extraction_part as an output-cap failure is,
      so the pipeline's attempt retry re-runs the section and
      `splitForAttempt` counts the failure from the claim's
      error_history (`thin_answers`); the ablation's (193) retry treats
      THIN_ANSWER as retryable and hands the second attempt the first's
      failure. On an attempt after one, the answer is kept and marked:
      a THIN_PART_ANSWER coverage issue with the signals and the part,
      and the routed families' SECTION_FAMILY and FACT_TYPE coverage
      UNRESOLVED on the section whatever the model's coverage said;
      never accepted in silence. The guard runs on lean attempts (a
      run's work row or the ablation's row; a bare draft call in a test
      does not carry an attempt and is unchanged unless it asks with
      thinAnswerGuard), so the fixtures' minimal answers stand. Cost:
      one extra call on the parts that trip it; on the confirmation's
      Sonnet high run none of 5.1's parts would have, on Opus 5.5
      medium two, and the article introductions answered with no facts
      would be re-asked once and then marked for the review. Pinned
      (tests/product-thin-answer.test.js, 3, registered in
      test:active): the 5.1 part 1 shape (one fact on a 10,500-byte
      part, 2,079 output tokens: thin by uncited bytes and by budget
      and output; the same part with 17 facts and 22,739 tokens not;
      a residual paragraph in the routed family uncited thin on its
      own, the same paragraph in another family or cited not; a short
      empty part not, a long empty one yes); Concho 6.3 unsplit
      answered with no facts (the article-introduction shape): the
      first attempt THIN_ANSWER, the attempt after kept with
      THIN_PART_ANSWER and NO_SHOP UNRESOLVED, a full answer untouched,
      a bare call unchanged, an attempt token alone turning it on; and
      split into parts with part 1 thin: the failure names part 1, and
      the attempt after keeps the other parts' facts with part 1
      marked. Not read: the job's recording for III-INTRO (the sandbox
      is not this session's); the shape pinned is the empty routed
      answer the manager's read describes. npm run test:active: 858
      tests, 857 pass, the one known failure.

      (199a) 2026-10-22 02:40 to 03:20 UTC (implementer E), the
      manager's question on the (198) re-fire's one remaining shape
      loss (pm-ablation-20261022T013924Z: 4.1 on MODEL_RESPONSE_SHAPE
      proposal.client_ref; the evidence_quotes[].source_span_id
      failures gone), answered with code: yes, the same repair covers
      the refs. The compiler requires proposal.client_ref,
      group.client_ref and (for the group lookup) proposal.group_ref as
      strings and fails the section on the first proposal without one.
      The lean normaliser now reads each by any name the model gave
      (client_ref, ref, id, proposal_ref; group_ref, group, group_id; a
      number as its string), names a proposal without one p<n>, gives a
      proposal without a group one of its own family and subtype, writes
      a group the proposal names but no group line carries (the cut, or
      the slip), and drops a group with no ref at all (refs_repaired,
      groups_synthesised, groups_dropped in the note); links follow the
      repaired refs through (197)'s endpoint reading. The recorded 4.1
      answer is the sandbox's to read; the shapes pinned are the ones
      the message admits: a proposal under ref with no group, a numeric
      client_ref with a group named and not written, a group under id,
      a group with none, the section compiling with both facts VALID
      and the link kept. Not covered, named for the record: a group
      whose family is outside the routed set still fails the section
      (GROUP_FAMILY), since the normaliser does not know the routing;
      the (189) replay fitness check catches it on replays, a live
      answer would need the routed families handed to the normaliser.
      Tests: tests/product-lean-answer-repairs.test.js (5),
      tests/product-lean-request-profile.test.js (the stats' keys). npm
      run test:active: 859 tests, 858 pass, the one known failure.

      (199b) 2026-10-22 05:55 to 06:40 UTC (implementer E), read-only
      on the manager's question ((223): where the thin answers on 5.1
      and the article introductions come from under Sonnet in the
      derived and merged modes, when the plain mode held 5.1 at 63 / 3
      / 0). The recorded answers are the sandbox's; what this session
      can do is build the requests the three rungs send and diff them,
      which it did on Concho 6.3 split into four parts with the
      ablation's own profile mapping for the CLI (profileForProvider:
      the DEFAULT profile's all-families contracts become the routed
      ones on the CLI, as anchors_sonnet55 sends). The result, every
      key compared: on a split section the merged_residual_sonnet55
      part requests are byte-identical to anchors_sonnet55's (the
      residual folds into the extraction only when the section goes out
      as one call; a split section keeps its residual call and its
      extraction requests unchanged); the derived_statement_sonnet55
      part requests differ by one sentence in scope_instruction ("Do not
      return statement ... put every operative word in the components")
      and the statement field absent from the response contract. On an
      unsplit section the merged request adds residual_paragraphs, the
      residual instruction and paragraph_dispositions to the contract.
      So on 5.1 the prompt cannot be the cause for the merged lever,
      and the same loss on both levers in both runs ((221) and (223):
      50 / 1 / 15 of 66 four times, against one plain measurement of
      63 / 3 / 0) is the shape of a deterministic difference, not of
      the model's run-to-run variance in thinking. What differs
      deterministically between the plain rung and both levers, by
      the code: the variant's profile name (ANCHORS against DEFAULT,
      which runSectionAblation maps to a different model config for
      the live factory, ANTHROPIC_API_MODEL_CONFIG against the V3
      default), and nothing in the request bytes. Three readings of
      the 5.1 rows settle it, all in ablation.json: (1) the LONG_
      SECTION_SPLIT issue's message on the plain row and the levers'
      rows (parts, operative_spans_per_part, chapeau_in_part,
      after_output_cap, resplit_parts): if the parts or the chapeau's
      part differ, the split is the cause and the lost facts are the
      chapeau's (the ordinary-course and efforts covenants, the consent
      standards and the exceptions the manager named on Opus 5.5
      medium are the section's opening words, which only the part that
      "also covers the section's own opening words" is told to emit);
      (2) the lean_note and issue_codes of the levers' 5.1 rows
      (anchors_unresolved, statements_fallback, proposals_dropped,
      INVALID_FACT_COMPONENTS): facts written and held or dropped
      against facts never written; (3) the fifteen unmatched facts'
      summaries against the chapeau sentences. For the introductions
      (III-INTRO 3, IV-INTRO 2, lost whole on the derived rung and not
      on the plain): the article_introduction_instruction is the same
      on both (the routing is replayed), so the derived sentence is the
      only difference in the request; the same two readings, (2) and
      the issue codes, say whether the model wrote qualification facts
      the normaliser dropped (a span-less component under "put every
      operative word in the components" would have been dropped by
      (198) with its ref in dropped_proposals) or wrote none. Proposed,
      not built, in the order the evidence would support them: (a) if
      the split differs, nothing in the prompt; the split's input is
      the stored claim's error_history and the closure, both the same
      for every rung, so the difference would be in how the two profile
      names reach longSectionGroups, to be read in the rows first; (b)
      if the introductions' facts were written and dropped, the derived
      sentence's second clause goes ("put every operative word in the
      components" pushes the model to component trees whose children
      carry words without spans; the statement is derived from whatever
      OWN words resolve, so the clause is not needed) and the first
      clause stays; (c) if the facts were never written, the part
      instruction for the part that covers the opening words gains the
      count: "the opening words state N sentences of covenant and
      standard; emit a proposal for each" where N is the chapeau's
      sentence count, and the levers run with fact_budget: true so every
      part carries its expected count from its bytes (the rung exists,
      (185)); for an introduction, "an introduction that states
      exceptions yields one REPRESENTATION_QUALIFICATION per source of
      exception; return them although no numbered representation is in
      this section", added to article_introduction_instruction. The
      measured saving of the derived statement, 4 per cent of the
      output in (223) after 12 and 17 in the two runs before, is inside
      Sonnet's run-to-run variance; the merged residual's saving is the
      residual calls, which the rows' extraction columns do not count
      and the job log's call count does. No code in this push. npm run
      test:active: 859 tests, 858 pass, the one known failure.

      (199c) 2026-10-22 06:35 to 07:30 UTC (implementer E), work package
      E10 from the guard's check rows (pm-ablation-20261022T053736Z,
      the manager's reading at 06:32 UTC: every row "attempts": 1; the
      derived rung's III-INTRO two facts written and held, 3.7 none of
      five, 5.1 47 / 3 / 16; the plain rung whole on the introductions
      and 3.7 and 63 / 3 / 0 on 5.1; the merged rung III-INTRO 0 of 3).
      Nothing run. (a) The derived sentence's second clause is gone
      ("put every operative word in the components"); the first stays.
      The held III-INTRO facts are (199b)'s reading (b): written, and
      held or dropped on their components' words. (b) 5.1: with the
      merged lever's part requests byte-identical to the plain mode's
      ((199b)) and the plain rung at 63 / 3 / 0 once and 48 / 3 / 15
      twice on those bytes, the loss is the model's own variance on the
      part that covers the opening words, reading (c); the split and
      the notes in the rows are the manager's to confirm, the sandbox
      being out of this session's reach. Built behind its own flag,
      `part_counts`: the part that covers the section's opening words
      hears how many sentences they state ("The opening words state N
      sentences of covenant, standard or exception; emit a proposal for
      each legal effect of each of them, never fewer than the sentences
      that state one"; `sentenceCount`, a page-footer number between two
      words not a boundary), and every part carries `part_fact_budget`
      from its own bytes (`factBudgetFor`, the part named) with the
      check-not-target sentence and "treat an answer well under it as a
      sign that limbs were skipped". (c) Behind `introduction_counts`:
      an article introduction routed to REPRESENTATIONS also hears
      INTRODUCTION_COUNT_INSTRUCTION, one REPRESENTATION_QUALIFICATION
      proposal per source of exception named, returned although no
      numbered representation is in the section, each citing its
      exception's words. Rung `counts_sonnet55` carries both flags on
      Ben's tier (the default words otherwise), so the next job can
      measure them against anchors_sonnet55 on the eight sections. (d)
      The guard and a held-whole answer: the uncited-words signal
      cannot see a part whose every written fact is held, since held
      facts cite their words; for the review the outcome is the same as
      an empty part, so the retry should see it, with a distinction the
      hold reasons make: a hold on the model's own words (anchors or
      offsets unresolved, a span-less component dropped by (198), a
      missing span) is a slip a second attempt can mend and belongs to
      the guard; a hold the validator's rules make on correct words (a
      cross-reference that does not resolve, a role missing, a
      qualification subtype rule) would recur and belongs to the
      validator alone. Not built here: the guard runs before the
      compiler and the hold reasons are known after it, so the signal
      needs the compile result handed back to the guard; proposed as
      the guard's fourth signal, "every written fact held on the
      model's own words", for the next package. Tests:
      tests/product-fresh-sheet-experiments.test.js (the derived
      sentence's clauses; part_counts on Concho 6.3 split, the
      opening-words part's sentence count and every part's budget,
      absent without the flag; introduction_counts on Concho III-INTRO,
      absent without the flag; the rung). npm run test:active: 860
      tests, 859 pass, the one known failure.

      (199d) 2026-10-22 08:35 to 09:30 UTC (implementer E), work package
      E11, 5.1's part 1 across five runs on identical bytes ((225):
      plain 63 / 3 / 0, 48 / 3 / 15, 48 / 3 / 15, 56 / 3 / 7, 60 / 2 /
      4; derived 47 to 50; counts_sonnet55 56 / 3 / 7; the lost facts
      the chapeau's covenants; the guard silent because the part cites
      its words and omits facts). The five rows and the recorded part-1
      answers are the sandbox's, not this session's; built from the
      code and the manager's reading, both of the asked changes, (c),
      behind the part_counts flag so the plain rung stays the control.
      (a) The split rule: under part_counts a chapeau of
      CHAPEAU_OWN_PART_SENTENCES (3) or more sentences is a part of its
      own (`longSectionGroups` with `chapeau_own_part`, the floor
      `chapeau_min_sentences`), the lettered limbs grouped after it as
      before; the part's operative list is empty and its instruction
      says so ("This part covers only the section's own opening words
      ... the lettered limbs are other parts' and are context here"),
      with the sentence count of (199c); the LONG_SECTION_SPLIT issue
      carries chapeau_own_part and chapeau_in_part 1. A chapeau under
      the floor stays with the first limbs as before, and without the
      flag nothing changes. (b) The minimum: under part_counts every
      part has a required minimum the thin-answer guard checks, the
      opening words' sentences on the part that covers them plus one
      proposal per lettered limb; fewer proposals is BELOW_PART_MINIMUM
      (`thinAnswerSignals` with minimumProposals), a failed attempt the
      first time and a marked part after, as (199)'s other signals,
      whether or not the words are cited. The cost: a limb that states
      no fact (a definition, a cross-reference) makes its part short by
      one and buys one retry and a mark the review sees, which is the
      right side to err on for the interim covenants. Pinned
      (tests/product-thin-answer.test.js, 5): Concho 6.3 split with the
      floor at one sentence: the chapeau part with no limb, its
      instruction and the split issue, the limb parts without the
      chapeau, the section whole; without the flag the first part
      carrying the chapeau with the limbs; the floor at 99 keeping them
      together; a chapeau part with no proposal failing the attempt on
      BELOW_PART_MINIMUM with the part named, a limb part one short the
      same, the attempt after kept and marked. Ready for the manager's
      three runs of 5.1 on the plain rung and counts_sonnet55. npm run
      test:active: 863 tests, 862 pass, the one known failure.
      (199e) 2026-10-22 10:40 to 12:20 UTC (implementer E), work package
      E12 ((226), the four items), behind the part_counts flag; nothing
      run on the sandbox, no job fired, no live call. (a) The
      opening-words count is the limb's. `limbLead(text)` reads a limb's
      lead paragraph: the words before its first "(i)" or "(1)" after
      white space, a cross-reference ("clause (i)", "and (i)") passed
      over, a colon or semicolon before the marker ending the lead, the
      limb's own label stripped. For every limb of a part whose lead is
      at or over THIN_ANSWER.paragraph_min_bytes (80) the part
      instruction names the limb and its lead's sentence count
      ("Opening words of the limbs in this part: limb s8 states 2
      sentences before its first numbered sub-limb; limb s9 states 1
      sentence ... Emit a proposal for each legal effect of each of
      those sentences (each affirmative covenant, each consent
      standard, each source of exception), never fewer than the
      sentences, each citing that limb's span."), and the part's
      minimum is the sum of those counts, plus the chapeau's sentences
      when the chapeau is at or over paragraph_min_bytes (the (199c)
      sentence and the (199d) own-part split stay for such a chapeau
      and for no other: a heading line of 32 bytes gets neither), plus
      one for a limb without a lead that is at or over
      paragraph_min_bytes (as (199d) counted every limb; one under 80
      bytes counts nothing). part_fact_budget and
      part_count_instruction stay on every part. On 5.1's layout the
      part with the heading and limb (a) has a minimum of 2 (the two
      sentences before "(i)") and the part with (b) and (c) names (b)'s
      one sentence. (b) No part of a heading alone. `foldShortGroups`
      in `longSectionGroups` folds a group under paragraph_min_bytes
      into the group that follows it (the heading joins limb (a)'s
      group even when every limb exceeds group_bytes: [32, 2729],
      [609], [347]); `resplitAfterOutputCap` halves a failed group
      between its substantive members only, and a failed group with one
      substantive member (5.1's [heading, limb]) is split by that
      limb's paragraphs with the heading folded into the first run, a
      paragraph part that also covers the chapeau (mode 'paragraphs',
      covers_chapeau true, the chapeau words in its instruction); a
      chapeau under paragraph_min_bytes is never its own part whatever
      chapeau_min_sentences says; `thinAnswerSignals` applies no
      minimum to a part under min_operative_bytes (2,000), so 5.1's
      limb (b) part (1,772 bytes) hears its count and is not failed on
      it. For the next 5.1 jobs the stored claim's cap history still
      shapes the split through splitForAttempt, and the heading no
      longer stands alone: the failed group [s4, s2] now becomes s2's
      paragraphs in runs of group_bytes with s4 in the first run when
      s2 holds two or more paragraphs and more than one run, else the
      group stays whole; the job's LONG_SECTION_SPLIT issue
      (operative_spans_per_part, mode) shows which. (c) A THIN_ANSWER
      retry re-runs the thin part alone. The draft no longer fails the
      attempt at the first thin part: every part answers, then the
      attempt fails naming the thin parts (error.extraction_part.mode
      'thin', thin_parts [1, ...]; the store's failureRecord keeps
      extraction_part as the history entry's `part`, so thin_parts
      travels), so the healthy parts' calls are recorded under their
      invocation ids. In lib/product/attempt-resume.js,
      `resumableInvocations` on a failure whose part has mode 'thin'
      makes every other part's invocation eligible (before: the parts
      below the failed part only, the output-cap rule), and the
      resuming model answers them from the record with zero spend and
      resumed_from_model_call_id; confirmed end to end on the code path
      (the first attempt's records through resumableCalls and
      resumingModel, the provider seeing part 1 alone the second time).
      The ablation harness has the same: `reusableAfterFailure` builds
      the identity map from the job's own records, the second attempt
      runs through resumingModel, the row carries replayed_calls and
      the table note names them. Read from the harness while building
      it, about the three (226) jobs: the job's recorder answers a
      request byte-identical to one it recorded, under the same model,
      effort and profile, from its own entry; the second attempt's four
      requests were byte-identical to the first's (the split and the
      instructions do not change between attempts), so by the code the
      retry read the first attempt's four answers back, the thin part
      1's included (kept and marked THIN_PART_ANSWER under the (199)
      rule), and the row's usage counted the recorded tokens twice:
      293,266 is 2 x 146,633 to the token. So the counts rung's 60, 60
      and 58 are first-attempt answers whole, one roll each, not second
      rolls, and the $3.04 is the double count; the rows'
      extraction.live_calls should read 4, not 8, and their issue codes
      THIN_PART_ANSWER 1. The harness test pinned this (the retry read
      the thin answer back) before the fix: the variant model's
      `refresh(section, parts)` now sends the failed part(s) live on
      the retry whatever the recording holds, and the healthy parts are
      records at zero, so a retry costs one part on the API and the CLI
      alike. (d) Pinned: tests/fixtures/product/conduct-of-business-
      layout.js (5.1's layout as the structure reads it: the 32-byte
      heading chapeau, limb (a) with a two-sentence lead before roman
      sub-limbs, limb (b) with a one-sentence lead, limb (c) with no
      sub-limb; 5.3 with a chapeau that states covenants in three
      sentences; the model that answers the counts the instruction
      names, less a shortfall); tests/product-thin-answer.test.js (7):
      5.3's chapeau its own part under the flag, 5.1's heading never
      (with limb (a), no chapeau count, limb (a)'s lead counted 2 and
      (b)'s 1, the split issue without chapeau_own_part), the fold at
      group_bytes 20, the lead reader's four cases; part 1 one short
      failing on BELOW_PART_MINIMUM (minimum 2, proposals 1) after both
      parts answered, thin_parts [1], the (b) part short but under
      min_operative_bytes passing, the attempt after kept and marked,
      the signal at 2,100 bytes and not at 1,700; the thin retry through
      attempt-resume (three calls reusable, part 1 not; the provider
      sees part 1 alone; three records at zero naming the originals;
      reusableAfterFailure the same map, nothing for a failure without
      a part); the cap re-split of [heading, (a)] into paragraph parts
      with the heading in part 1 and no empty part, and the halving of
      [32, 2000, 1800] cutting after the first substantive member;
      tests/product-fresh-sheet-experiments.test.js (11): 6.3's heading
      uncounted and each limb lead named exactly as limbLead reads it,
      5.1's two parts under the flag with the lead counts and the
      budgets, none of it without the flag;
      tests/product-ablation-wake.test.js (10): the harness on a stored
      run of the layout fixture whose 5.1 row carries a cap failure,
      the first attempt thin on part 1, the second replaying part 2 and
      sending part 1 live, the row's replayed_calls and attempts 2, the
      table note. Not changed: the Sonnet default, the rung names, the
      plain rung, scripts/product-hosted-worker.js,
      lib/product/fact-components.js. Ready for the manager's three 5.1
      jobs on both rungs once the sandbox is at this sha. npm run
      test:active: 866 tests, 865 pass, the one known failure.
      (199f) 2026-10-22 13:10 to 13:50 UTC (implementer E), work package
      E13 ((227)), the split changed by the manager at 13:32 UTC: E
      commits and pushes, the manager updates the sandbox and fires the
      eight-section job (this session holds no Vercel credentials; the
      Vercel MCP's named-sandbox read stops at a permission prompt no
      one can approve, so it is not used for the sandbox). (a) Built:
      the default_sonnet55 rung in lib/product/cost-ablation.js, whose
      profile is REQUEST_PROFILES.DEFAULT itself (the object, not a
      copy), claude-sonnet-5-5 at high effort writing the facts, routing
      and residual replayed, so a change to the default (part_counts in
      it since (227)) flows into the ladder without a new rung; its
      estimate factor is counts_sonnet55's (0.75 of the output), the
      same request on the same tier. Pinned in
      tests/product-fresh-sheet-experiments.test.js (11): the profile
      is the same object as REQUEST_PROFILES.DEFAULT, carries
      part_counts and not introduction_counts, the models and the
      replay, the factor under one. The retry fix the manager asked
      after: it shipped in (199e) at fb0b270/ebe5dc0 (the variant
      model's `refresh(section, parts)` sends the failed part live on
      the retry rather than reading the first attempt's answer back
      from the job's recording; the healthy parts come from the first
      attempt's records at zero spend through resumingModel), with its
      harness test in tests/product-ablation-wake.test.js (the provider
      sees part 1, part 2, then part 1 alone; the row's replayed_calls;
      live_calls 3); nothing more was needed for it here. What it
      changes on a row: before, a retried section's second attempt was
      four recorder reads counted again (live_calls 4 reported as a
      doubled usage, the thin part marked); after, one live call for
      the thin part and three records at zero, live_calls 4 + 1, the
      usage the calls made. (b) The eight-section check, read 15:05 to 15:40 UTC from the
      rows the manager pasted (pm-ablation-20261022T140617Z, the
      sandbox at 3be795f; default_sonnet55 and counts_sonnet55, two at
      once; no SECTION_RETRY, no "attempts": 2, no replayed_calls on
      any row, so every part was above its minimum). The
      introductions: III-INTRO 3 / 0 / 0 of 3 and IV-INTRO 2 / 0 / 0
      of 2 on both rungs, two valid facts each and nothing held, where
      (225) had 0 of 3 and 0 of 2 on the plain rung with every fact
      held on DUPLICATE_FACT_OCCURRENCE. A's (207), one voice on the
      introduction node, is what closed that; introduction_counts adds
      no fact over it (the output on III-INTRO 9,390 tokens on the
      default and 5,086 with the count, IV-INTRO 5,509 and 6,302:
      noise, not a pattern). Agreed with (228): introduction_counts
      stays out of the default; INTRODUCTION_COUNT_INSTRUCTION stays
      on the counts rung alone, a parked lever. The default holds the
      earlier readings elsewhere: 3.7 5 of 5 ((225) 5 of 5), 4.1 17 /
      1 / 0 ((225) 17 / 1 / 0 and 18 / 0 / 0), 8.3 44 / 2 / 0 with no
      retry ((225) 46 / 0 / 0 on a retry; the (199) guard did not need
      to fire this roll), 3.1 22 / 0 / 2 ((225) 20 / 1 / 3), 3.2 24 /
      1 / 2 ((225) 25 / 0 / 2); 3.1's and 3.2's unmatched on both
      rungs are the representation qualifiers of (218), the SEC
      filings exception and the Company Disclosure Letter exception,
      whose placement is Ben's open question, not a loss of the
      default. 5.1: the default 60 / 2 / 4 of 66 (the four lost: the
      Company consent standard, the Disclosure Letter exclusion, the
      Disclosure Letter, Agreement and Law carve-outs, the Parent
      consent requirement: limb (a)'s and (b)'s consent-standard and
      exception facts, the words the limb's sentence count names)
      against 63 / 3 / 0, 53 / 6 / 7 and 59 / 7 / 0 in (227); the
      counts rung 51 / 15 / 0, no fact lost and fifteen partials. The
      rungs whole: 177 / 6 / 8 and 160 / 27 / 4 of 191. What the
      fifteen partials are is (c)'s question: a different cut of the
      same words, not omissions; the one roll's list prices ($11.09
      against $4.29) are the CLI's reported cache split and are not
      read ((189)).
      (c) The two standing partials, read against docs/core/LEGAL-
      RULES.md ("One independently operative authored unit is one
      proposition. Store its conditions, exceptions and timing as
      roles or linked facts"), the schema's fact rule and the
      INTERIM_OPERATING layer rule ("Components follow the sentence:
      actor, operation, object, then each condition, exception,
      threshold, period and qualifier as its own component; lists that
      vary between deals as LIST with LIST_ELEMENTs"), the components
      contract's R2 (one LIST_ELEMENT per element that could vary
      between deals) and the extractor's instruction ("Emit one
      proposal for each independently operative legal effect ... Do
      not combine distinct duties, actions, protections or remedies
      merely because they share a type or subtype. Never combine
      separate numbered or lettered sibling limbs in one proposal").
      No rule change; Ben decides the shape of a fact. The Tax
      covenant: the stored run wrote one fact for the limb (one "shall
      not", one consent standard, five prohibited Tax actions
      separated by semicolons, no numbering); the live rungs wrote one
      fact per action (the counts rung's counterpart, the limitation-
      period waiver alone, overlaps 0.24 of the stored bytes, about
      one action in five). The instruction's sibling-limb sentence
      does not reach it (nothing is numbered); its distinct-actions
      sentence does, since settling a Tax liability, filing an amended
      return, making an election, waiving a limitation period and
      changing a Tax accounting method are each breachable alone; the
      family's layer rule and R2 point the other way, a list of
      prohibited actions that varies between deals being the LIST
      case. Reading the words: one operative verb, one consent
      qualifier, one object list, so the stored cut (one fact, the
      five actions as LIST_ELEMENTs under the operation) reads them
      better, and the live cut multiplies the chapeau and the consent
      standard five times over, which is what the counts rung's
      fifteen partials look like. If Ben confirms that shape, the
      repeatable fix is one sentence in the extractor's instruction
      naming a semicolon list of objects under one verb as LIST
      elements of one proposal, across the corpus; not written. The
      default rung's MATCHED counterpart for the Tax covenant is the
      equity-award covenant, not a Tax fact: the comparison
      (compareFacts in lib/product/cost-ablation.js, generation-
      comparison's rule) scores a stored fact by the best overlap of
      any live fact's OWN component bytes over the stored fact's OWN
      component bytes, MATCHED at 0.5 or more, the best candidate
      taken whatever else it already matched. A stored 5.1 covenant's
      OWN components carry the chapeau words the proposal repeats (the
      actor and permission "the Company shall not, and shall not
      permit any Subsidiary to", the consent standard, the Disclosure
      Letter, Agreement and Law exceptions) beside its limb's words,
      and on a short limb the chapeau bytes are the larger part; a
      live fact that quotes the whole chapeau as its own components
      (the default's equity-award counterpart does) overlaps that
      larger part and scores over 0.5 on a stored fact whose limb it
      never cites, while the live Tax facts, citing chapeau fragments,
      score under. To confirm from analysis/*.analysis.json: the
      stored Tax fact's component rows, their origin and bytes; if the
      chapeau rows are OWN and more than half its bytes, this is the
      mechanism. The matcher rule to consider, not changed: score on
      the stored fact's bytes outside the section's chapeau span when
      any remain (the limb's own words), so shared chapeau words never
      make a match alone, and let a live fact match one stored fact at
      most. Parent's extraordinary dividends: the stored run wrote one
      fact, the restriction with its proviso inside; the live rungs
      wrote two, the restriction and the proviso as a permission
      ("Notwithstanding the restriction ... Parent may make regular
      quarterly cash dividends", the default at 0.43 and the counts
      rung at 0.31 of the stored bytes). The proviso operates only as
      a carve-out from the restriction: it grants Parent nothing it
      lacked but for the covenant, so it is not an independently
      operative unit; LEGAL-RULES stores exceptions as roles or linked
      facts and the layer rule makes each exception a component of its
      covenant, an EXCEPTION component under the restriction. The
      schema's EXCEPTION subtype allows an exception as a fact of its
      own when linked, but the live rungs wrote it unlinked and with
      "Notwithstanding the restriction" in the model's words, not the
      agreement's. Reading: the stored cut (one fact, the proviso an
      EXCEPTION component) reads the words better; the live cut loses
      the tie between the restriction and its carve-out. Both readings
      are the manager's and Ben's to decide; nothing in the default,
      the rungs or the matcher changed for them. Not changed: the
      default profiles, the other rungs, the sandboxes, the deals,
      intake. npm run test:active: 866 tests, 865 pass, the one known
      failure.

      (199g) 2026-10-22 15:40 to 16:45 UTC (implementer E), work
      package E14 ((229)): the comparison matcher's rule, the re-score
      script, the pins; no extraction change, no run, no rule on fact
      shape; the sandboxes, the deals and intake untouched. The job
      dirs are on pm-codex-preview-worker-3 and this session reaches
      neither the status route nor the sandbox helper (no internal
      token, no Vercel credentials; the Vercel MCP not used), so the
      mechanism is confirmed on the code path and against the figure
      the manager quoted, and the re-score of the eight job dirs is
      the manager's to run with the command below; its rows are
      recorded here in place once sent. What "MATCHED share 1" says:
      the share is the live fact's OWN bytes over the stored fact's
      OWN bytes, so every OWN byte of the stored Tax covenant lay
      under the live equity-award covenant's OWN bytes. The chapeau
      mechanism of (199f) alone gives a share under 1 whenever the
      stored fact carries its limb's words with bytes, so one of two
      things holds: the stored Tax fact's OWN components with bytes
      are the chapeau words only (its five actions carried without
      bytes or under another origin), or the live equity-award fact
      carries a LIST component quoted from its first element to its
      last (the components contract: "A LIST quotes the words from its
      first element to its last"), which spans every sub-limb between
      them, the Tax sub-limb among them. `--dump 5.1:Tax` on a job dir
      prints the rows that settle it. The rule built covers both.
      (a) The rule, in lib/product/generation-comparison.js
      (`rangesOutside`, `scoredRanges`, `chapeauRangesOf`,
      `matchFacts`): a stored fact is scored on its OWN bytes outside
      the section's own chapeau span (kind CHAPEAU on the node) when
      any remain, else on all its bytes (a chapeau-only fact keeps
      them); every live fact is the counterpart of one stored fact at
      most, the pairs assigned best share first, a tie on the stored
      side broken by the live fact's own covered bytes (a wide LIST
      fact goes to the stored fact it mostly is), then source order.
      `compareFacts` in lib/product/cost-ablation.js uses it with the
      chapeau ranges of the stored closure row
      (`chapeauRangesOfClosure`: the section's own chapeau span ids,
      not a parent's) and its rows carry scored_bytes;
      `compareGenerations` uses it per node with the chapeau from both
      analyses' spans, its pairs carry scored_bytes and counterpart, a
      V1 fact V1 held takes no counterpart, and its `matches` list and
      the V2-side counterparts are unchanged in shape. Without chapeau
      ranges and with exclusivity off the function is the old rule,
      kept for the re-score. Expected on the rows: shared chapeau
      words no longer make a match, so a stored covenant is MATCHED or
      PARTIAL by its limb's words or UNMATCHED; a live fact that
      quoted the chapeau whole over one limb counts once, and the
      others it covered on the chapeau alone fall to their next
      candidate or to UNMATCHED; the partial counts of 5.1 and 3.2
      should fall where they were chapeau overlaps and the unmatched
      may rise; "new" counts the live facts no stored fact took.
      (b) The script, scripts/product/re-score-ablation.js: `node
      scripts/product/re-score-ablation.js <job dir> [<job dir> ...]
      [--json <file>] [--dump <section>:<summary words>]`, reading
      analysis/stored.analysis.json, analysis/<variant>.analysis.json
      and ablation.json of each job dir (the launcher writes all
      three), nothing written to the job dir. Per variant and section
      it prints the recorded counts (ablation.json), the old rule re-
      computed from the analysis files (the two should agree; a
      difference means the analysis files hold facts the row did not),
      the new rule, and every row whose status or counterpart changes
      with its old and new counterpart's summary and the scored bytes.
      On the sandbox at this head, from /vercel/sandbox/pm-product:
      `node scripts/product/re-score-ablation.js /vercel/sandbox/pm-
      ablation-20261022T070212Z /vercel/sandbox/pm-
      ablation-20261022T090218Z /vercel/sandbox/pm-
      ablation-20261022T093531Z /vercel/sandbox/pm-
      ablation-20261022T100454Z /vercel/sandbox/pm-
      ablation-20261022T113757Z /vercel/sandbox/pm-
      ablation-20261022T115652Z /vercel/sandbox/pm-
      ablation-20261022T121703Z /vercel/sandbox/pm-
      ablation-20261022T140617Z --json /vercel/sandbox/re-
      score-20261022.json`, and for the fixture rows `node
      scripts/product/re-score-ablation.js /vercel/sandbox/pm-
      ablation-20261022T140617Z --dump "5.1:Tax"` (the stored facts
      whose summary contains the words, their component rows with
      kind, origin and bytes, the section's chapeau spans, and every
      live fact that overlapped them under the old rule, per variant).
      The rows that change: pending the manager's run of the
      command; recorded here in place once sent.
      (c) Pinned in tests/product-rescore-ablation.test.js (5) on
      5.1's shape as read in (199f), the byte numbers the shape's
      until the dump's real rows replace them: the chapeau bytes out
      of a fact's ranges and a chapeau-only fact keeping its own; the
      old rule matching the Tax covenant with the equity-award
      covenant on the shared chapeau (0.69 of its bytes) and the rule
      scoring the limb (400 bytes) and taking the one-action Tax fact
      at 0.2; exclusivity and the tie; compareFacts with and without
      the chapeau ranges; compareGenerations' pairs with scored_bytes
      and counterpart; the script on a temp job dir, its old-rule
      counts equal to the recorded row, the changed row rendered, and
      --dump's rows. The existing suites hold (tests/product-
      generation-comparison.test.js 4, tests/product-cost-
      ablation.test.js 9, tests/product-ablation-wake.test.js 10);
      tests/product-cost-ablation.test.js is not in the test:active
      list (it runs under `npm test`'s glob), noted, not changed in
      this push. npm run test:active: 871 tests, 870 pass, the one
      known failure.
      (199h) 2026-10-22 16:50 to 17:50 UTC (implementer E), work
      package E15 ((230)): the matcher's second half withdrawn,
      bundling reported, the re-score's baseline made the recorded
      row; no extraction change, no run, no rule on fact shape; the
      sandboxes, the deals and intake untouched; the Vercel MCP not
      used. (a) `matchFacts` in lib/product/generation-comparison.js
      no longer assigns exclusively: every stored fact keeps its best
      live cover (the share on its bytes outside the section's chapeau
      span when any remain, (199g); a tie by the live fact's own
      covered bytes), and the stored facts whose counterpart is also
      another stored fact's counterpart come back as `bundled`.
      `compareFacts` (lib/product/cost-ablation.js) carries `bundled`
      on each row and `bundled` in the counts, the ablation table
      prints it beside the match ("5 / 0 / 0 of 5 (5 bundled)") on the
      rows and the totals (`ablationTotals.bundled`), and
      `compareGenerations` carries `bundled` on each pair and
      `v1_bundled` in its totals. So 3.7's five stored facts under one
      live fact read 5 / 0 / 0 of 5 (5 bundled), what they are; 5.1's
      five affirmative covenants of limb (a)'s lead, written live as
      one fact, MATCHED and bundled; and the Tax covenant, whose only
      overlap with the equity-award fact was the chapeau, PARTIAL by
      its own limb's words. On the old rule the same Tax row reads
      MATCHED and bundled with the equity covenant, which is the false
      match of (229) named for what it was: a bundle on shared chapeau
      bytes.
      (b) Why the earlier re-score's old-rule column did not reproduce
      the recorded rows, read from the code (the job dirs are out of
      this session's reach): the live comparison and the first script
      derived the facts' bytes differently. The live comparison ranges
      a stored fact from the snapshot's component rows (every depth,
      OWN origin, bytes present) and a live fact from its compiled
      components with no span map, so a VALID fact with no OWN
      component carrying bytes has no bytes and matches nothing; the
      first script read both sides from the analysis files through
      `factRanges` with the section's span map, under which such a
      fact takes its cited spans whole (its whole limb, or the chapeau
      and limb spans a V1 fact cites), and matches everything in them,
      which is more matches, as every disagreement the manager listed
      was (64 / 2 / 0 against the recorded 60 / 2 / 4; 62 / 4 / 0
      against 53 / 6 / 7). Two smaller differences beside it: the
      stored analysis export attached a fact's children one level
      deep, so a LIST's elements under a nested component were missing
      from the analysis file (fixed: `componentTree`, every depth, in
      `analysisFromStoredRows`), and the first script counted a live
      proposal without a validation status as VALID where the live
      comparison requires the status. Built so the question cannot
      recur: `storedFactsForNode` is now the one derivation of a
      section's stored facts and chapeau ranges, used by
      `runSectionAblation` and by the re-score; the re-score reads the
      job's ablation-rows.json (the launcher dumps it) for the stored
      side and the variant's analysis file for the live side with the
      compiled bytes and no fallback, and computes its baseline
      through `compareFacts` with no chapeau ranges, the very function
      and inputs that wrote the recorded row. It prints the recorded
      counts, the rebuilt baseline, "NOT REPRODUCED" with the rows
      that differ when they do not agree (from ablation.json's
      comparison rows), the new rule's counts with the bundled count,
      the rows that change, the bundled rows, and a `drift` note per
      section naming the facts the analysis-file derivation treated
      differently (stored or live facts without OWN byte components
      and the span bytes they would have taken; stored facts whose
      analysis-file tree carried other bytes than the snapshot rows;
      live facts without a status). Which of these carried each job's
      difference is in that note when the manager runs it; the code
      says the fallback, and the note will say the facts.
      (c) The command, on the sandbox at this head, from
      /vercel/sandbox/pm-product: `node scripts/product/re-score-
      ablation.js /vercel/sandbox/pm-ablation-20261022T070212Z
      /vercel/sandbox/pm-ablation-20261022T090218Z /vercel/sandbox/pm-
      ablation-20261022T093531Z /vercel/sandbox/pm-
      ablation-20261022T100454Z /vercel/sandbox/pm-
      ablation-20261022T113757Z /vercel/sandbox/pm-
      ablation-20261022T115652Z /vercel/sandbox/pm-
      ablation-20261022T121703Z /vercel/sandbox/pm-
      ablation-20261022T140617Z --json /vercel/sandbox/re-
      score-20261022b.json`. Read first whether any row says NOT
      REPRODUCED; the rest is read only where the baseline is the
      recorded row. The reading per job and rung (matched, bundled,
      partial, unmatched; whether (227) and (228) hold) follows in
      place once the table is pasted. Pinned in tests/product-rescore-
      ablation.test.js (5): the helpers; matchFacts on the Tax and
      equity shape with and without the chapeau (the old rule's
      bundle), 3.7's five under one, the tie; compareFacts with the
      five affirmative covenants bundled and counted, the old reading,
      the table's bundled column on the row and the totals;
      compareGenerations' pairs and totals with bundled; the script on
      a job dir with the snapshot (the baseline equal to the recorded
      row, the new column, the changed rows, the bundled rows, the
      table), the drift note on span-only facts, the nested tree read
      whole, a job dir without the snapshot, a recorded row the
      baseline cannot reproduce said so, and --dump. The existing pins
      updated for the bundled count (tests/product-cost-
      ablation.test.js, tests/product-ablation-wake.test.js,
      tests/product-generation-comparison.test.js). npm run
      test:active: 871 tests, 870 pass, the one known failure.
      (c), read 17:55 to 18:15 UTC from the manager's run ((233), the
      sandbox at 401c035): the rebuilt baseline equals the recorded
      matched / partial / unmatched on every row of the eight job
      dirs, and the rule as it stands changes none of them, so (227)
      and (228) hold as read; what the re-score adds is the bundled
      count (5.1 5 to 45 of 66 by rung and roll, 3.7 all 5, 3.1 5 to
      8, 4.1 2 to 3, III-INTRO 2, 8.3 and IV-INTRO none). Eleven rows
      differ in the "new" count alone, the recorded one larger by one
      to seven (070212Z plain 5.1 9 against 8, counts 34 against 31,
      merged 37 against 30; 090218Z plain 5.1 32 against 28; 093531Z
      counts 36 against 35; 121703Z counts 11 against 10; 140617Z
      counts 3.2 3 against 4, default 3.1 2 against 1, default 5.1 27
      against 26, derived 4.1 2 against 1, plain 3.2 3 against 2).
      Why, from the code: "new" is the live facts no stored fact took
      as its counterpart. The job's compareFacts took, for each stored
      fact, the first live fact in answer order among those at the
      best share; the matcher since (199g) resolves that tie by the
      live fact's own covered bytes, so a stored fact covered whole by
      a wide live fact and by a narrow one of its own takes the narrow
      one where the job took the wide one, every status and share the
      same, and the narrow facts the job counted new are taken. That
      is one direction, and the eleven rows all run that way (3.2 on
      the counts rung, 3 against 4, is the same tie resolved the other
      way round). Pinned in tests/product-rescore-ablation.test.js:
      two stored facts under one wide live fact and two narrow ones,
      the job's count new 2, the rule's new 1, the statuses equal; the
      script now judges reproduction on the status columns and prints
      "new differs ... a tie on equal shares" as its own note rather
      than NOT REPRODUCED. Does it matter: no reading rested on the
      new count ((227), (228) and (233) read matched, partial and
      unmatched); with bundling reported, the count of live facts no
      stored fact took is the better of the two readings, since it
      names the live facts outside every stored fact's cover rather
      than the ones left over by answer order. Not changed: the
      matcher; nothing else is open for E. npm run
      test:active: 872 tests, 871 pass, the one known failure.
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

- Query on layered facts (Ben, 2026-10-18: "we do need to build a
  query function etc but we should be thoughtful on how we do that once
  we have solid data we're happy with - add to the future planning
  (probably the first thing we build as it will drive the side bar
  etc)"): the first feature after the internal release, built on the
  activated releases' conclusions cells across agreements; its design
  note is implementer C's (finding (163)); legacy Query and Compare
  stay unrouted until then.
- A CVR product of its own (Ben, 2026-10-18: "For CVRs - I want to build
  a separate product for that"): a Form of CVR Agreement exhibit is out
  of this product's scope.

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

(2026-10-23: the loop runs on Claude Code Remote sessions, the manager
with hourly self check-ins and the implementers woken by triggers; see the
handoff note named in section 12. The steps below are the original design.)

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

Current wording, 2026-10-24. Superseded: the 2026-09-04 wording (a Sol
implementer at Phase 0) and the 2026-10-23 wording (a manager on Claude Code
Remote sessions with MCP triggers). The `git` state, the runs and the open
defects are in `docs/codex-program/notes/MANAGER-HANDOFF-2026-10-23.md`,
whose section 0 is the 2026-10-24 update; findings (237) to (245) carry the
evidence.

```text
/goal Own the Precedent Machine internal product launch through completion.
Read docs/core, then section 0 of
docs/codex-program/notes/MANAGER-HANDOFF-2026-10-23.md, then findings (237) to
(245) in docs/codex-program/notes/PRODUCT-LAUNCH-IMPLEMENTATION-PLAN-2026-09-04.md.
Adopt that single checklist and update it in place with numbered findings; no
second planning or status document.

You run on a DeepSeek-backed agent with no Vercel or Supabase MCP tools. You
drive the product with plain curl against the preview deployment and with
subagents in their own git worktrees. To reach a protected preview you need,
from Ben: the Deployment Protection bypass secret (send it as
x-vercel-protection-bypass) and PRODUCT_INTERNAL_TOKEN (send it as
Authorization: Bearer). A Vercel API token is needed only to update the worker
sandboxes or read deployment state; ask Ben for one if a sandbox must move to a
new commit. Never write a secret into the repository or a commit.

Where things stand: two deals have run end to end. Apogee on Claude
(88d4032a, READY, 858 valid facts, 11 held) and Apogee on DeepSeek
(34847358, READY, 758 valid, 116 held, $18.02). Olaplex (ab1cf03b) is paused
at 27 of 87 and resumable. The PW design branches are merged into the codex
line at 092a6239. The main path is: trust the facts on one deal; the lawyer
loop end to end (review, publish, release, rollback drill); the second deal;
surfaces on released facts; the structured review-feedback backend after the
first published review; production cutover on Ben's explicit approval.

Work the plan's next steps in the order section 0 gives them, beginning with
the silent-absence guard (a section that returns no facts must never read as
"this agreement has no such provision") and the Company's breach termination
right lost to a cross-reference. Verify every push before merging: run the
tests the machine can run (lib tests need no install; component tests need the
ad-hoc-signed node at /tmp/dsh-node-unsigned; anything database-shaped must be
checked on the preview deployment), read the facts yourself, and push both
codex/product-implementation-plan-20260904 and
claude/festive-albattani-70cwn5. Give every parallel agent its own git
worktree with a symlinked node_modules; never let two agents share a checkout.

Judge progress by the working SEC-URL-to-reviewed-summary product on a real
deal, not documents, receipts or test counts. Keep Ben's standing rules:
everything driven by code and repeatable across the corpus; read the output
yourself and iterate; no lawyer decisions on his behalf; no force-push; no
secrets in the repository; no model identifiers in commits; section 9 checks
only; do not switch the default provider without evidence and Ben's decision.
Stop only for a genuine legal ambiguity, a fact-shape decision, a proposed
weakening of the release bars, the database-cost choice, or the production
cutover approval, and put each to Ben in plain options with a recommendation.
```
