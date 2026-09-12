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
      inventory is not required.
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
- [ ] 5B.2 Legal schema V2. Draft written 2026-09-12:
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
- [ ] 5B.3 Extraction prompt V7 and storage. Extraction half done
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
      Remaining: apply the migration to the private preview database,
      recorded-fixture replay under V7, and the database check.
- [ ] 5B.5 Published reader view on layers, built first. Component merged
      2026-09-12 from the 5B.5 worker: `components/product/PublishedSummary.jsx`
      and `lib/product/published-layers.js` render headline first, click to
      descend, inherited words marked, values beside thresholds, references
      on hover, coverage-only facts hidden, against
      `tests/fixtures/product/published-layers-fixture.v2.json`
      (`tests/product-published-layers.test.js`). Remaining: wire into the
      accepted summary in `ReviewWorkspace.jsx` and one browser check.
- [ ] 5B.4 Review page is the production page plus aids (Ben, 2026-09-12:
      "the next review page I see to be the final production style page just
      with additional things added to aid review"). The focused page renders
      facts exactly as `PublishedSummary` does and adds, per fact, the
      decision buttons, comment, revert, held content, the brief's "look for"
      line and click-to-highlight of cited words in the provision text. No
      second renderer. Depends on 5B.5. Files: `components/product/FocusedReview.jsx`,
      `lib/product/review-state.js` for component-level edits. Proof: display
      tests and one browser check.
- [ ] 5B.6 Rerun NCS under V2 as a new generation. Compare against Ben's 38
      touched items and his samples. Ben reviews the same 13 provisions again
      on the layered page. Comparison tooling merged 2026-09-12 from the 5B.6
      worker: `lib/product/review-comparison.js` and
      `scripts/product/compare-review-items.js` map V1 review items to V2
      facts by node and byte overlap and write a Markdown report
      (`tests/product-review-comparison.test.js`).
- [ ] 5B.7 One untouched agreement under V2, then the Phase 5 exit.

Parallel plan while Ben is away: 5B.1 and 5B.2 are lead work in this
session. 5B.3 storage and 5B.5 reader view run as separate visible sessions
against fixtures built from the contract, with no overlapping files. 5B.4
starts when 5B.5 lands, so the review page and the production page share one
renderer. Prompt V7 waits for 5B.2. Worker sessions started 2026-09-12 20:30
UTC: 5B.3 `session_01TcSpkRunUNCnKiVMntUZRC`, 5B.5 `session_01XN3SV7RNQ5auN72cmE4Fzx`;
the first 5B.4 session was archived unstarted when Ben set the
production-page rule.

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
