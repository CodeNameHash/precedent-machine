# Review feedback and quality backend: handoff to the codex manager

**Last updated:** 2026-10-24  
**Owner:** codex manager page  

**Status:** deferred. Do not build this in the base app yet.
**Base branch:** `design/corpus-pw-base`
**Review UI branch:** `design/corpus-pw-index-review` (UI only, parked)

## Product position

The base app presents the extracted facts as correct. There is no review
methodology, no review navigation and no feedback surface in the base. The
lawyer preview (`/review/product/[id]/provisions`) is read-only; the deal
index is the entry point.

Review methodology comes after the comparison and search surfaces. When it
is built, the UI is a reading workflow: exact clause, interpretation chain,
coverage gap, then a decision. The design is in
`corpus-pw-review-reading.html` and on the parked review UI branch.

The backend is the codex manager's work. This brief is the scope.

## What exists today

- Immutable review revisions and decisions:
  `DECIDE_ITEM` (accepted, edited, rejected, unresolved), `COMMENT_ITEM`,
  `ADD_MISSING_FACT`, `UPSERT_RELATIONSHIP`,
  `CONFIRM_AGREEMENT_COVERAGE`, `RESET_ITEM`, `RESTORE`, `SAVE_PROGRESS`.
- Publishing: `PUBLISH` creates a release candidate, `EVALUATE_RELEASE`
  checks it, `ACTIVATE_RELEASE` moves the agreement's release head,
  `ROLLBACK_RELEASE` moves it back. Prior releases are immutable.
- `product_agreement_release_heads` maps a source document to its active
  release. `page/query/provisions` and the comparison read active releases.
- Development quality: `DEVELOPMENT_REGRESSIONS/V1` has 50 curated cases
  across seven classes (`NO_RUN`, `WRONG_MEANING`, `MISSING_ROLE`, `PARSER`,
  `DUPLICATE`, `DISPLAY`, `CONTROL`). `generation-comparison` compares two
  generations. `review-comparison` maps V1 review items onto V2 facts.
- There is **no** structured per-fact feedback record, no live error
  aggregation, no denominator of reviewed facts, no trend by model or
  prompt, and no triage-to-regression workflow.

## What the backend must add

### 1. Structured review feedback

An append-only `review_feedback` table, separate from review decisions:

- `feedback_id`, `run_id`, `revision_version`, `proposal_id`, `item_id`,
  `component_id` (nullable)
- `target_kind`: `SOURCE`, `COMPONENT`, `ROLE`, `VALUE`, `LINK`, `COVERAGE`,
  `HEADLINE`, `CLASSIFICATION`
- `error_class`: `WRONG_MEANING`, `MISSING_ROLE`, `WRONG_ROLE`,
  `WRONG_SPAN`, `EXTRA_COMPONENT`, `MISSING_COMPONENT`, `DUPLICATE`,
  `SHOULD_SPLIT`, `SHOULD_MERGE`, `WRONG_LINK`, `MISSING_LINK`,
  `NORMALIZATION`, `COVERAGE_GAP`, `SCHEMA_GAP`, `SOURCE_AMBIGUITY`,
  `DISPLAY`, `CONTROL`
- `cause`: `MODEL`, `PARSER`, `SCHEMA`, `SOURCE_AMBIGUITY`, `REVIEWER`
- `severity`: `BLOCKER`, `MATERIAL`, `MINOR`, `QUESTION`
- `reason_code`, `note`, `expected_words`, `source_span_ids`
- `reviewer_id`, `model`, `prompt_version`, `schema_version`, `generation`,
  `family_key`, `section_reference`, `source_document_id`
- `status`: `OPEN`, `CONFIRMED`, `FIX_PROPOSED`, `REGRESSION_ADDED`,
  `FIXED`, `VERIFIED`, `DISMISSED`
- `created_at`, `updated_at`

Feedback must be possible at component level, not only at fact level.
Reject and unresolved decisions should require a structured reason. A
free-text comment alone is not enough. Multiple feedback rows can point at
one item; they are immutable and superseded by status, not edited away.

### 2. Denominators and aggregation

The system needs to know what was reviewed, not only what was flagged:

- facts reviewed
- components checked
- sections and agreements reviewed
- reviewers
- runs and generations
- model and prompt version

An aggregate view should report, by error class and cause:

- confirmed errors / reviewed facts
- confirmed errors / reviewed components
- material or blocker errors / reviewed facts
- trend by week, generation, model and prompt version
- confidence intervals, not raw counts
- top examples with links to the exact source span and feedback

A **systemic** signal requires the rate to be above baseline across several
deals and reviewers, not one run or one lawyer. State the threshold in code
and show it.

### 3. Triage and regression loop

Each confirmed feedback row has an owner and a state:

`OPEN -> CONFIRMED -> FIX_PROPOSED -> REGRESSION_ADDED -> FIXED -> VERIFIED`

The `REGRESSION_ADDED` action writes a minimal case into
`DEVELOPMENT_REGRESSIONS` with the source span, the expected correction and
the error class. A fix is not verified until the next generation passes that
case. This reuses the existing fixture and generation-comparison machinery.

### 4. Corpus and release boundary

Feedback must not mutate the fact corpus. The release path stays:

`review decisions -> publish candidate -> evaluate -> activate release -> active release head`

Only accepted or edited facts in an activated release enter the published
fact corpus. Rejected and unresolved facts do not. A new generation or
review creates a new release; old releases remain recoverable.

Release metadata should record the review quality snapshot (open feedback
by class, severity, reviewer coverage) so a published release is not
mistaken for a clean one. Feedback status changes do not rewrite the
release.

### 5. Access and audit

- Same authentication and least-privilege model as review.
- Reviewer identity on every row.
- No source or privileged text in aggregate views.
- Feedback exports for the model owner, without service credentials.
- Append-only audit; no hard deletes.

## Explicit non-goals for now

- No review UI in the base app.
- No automatic training on lawyer decisions.
- No automatic corpus updates from feedback.
- No coupling to comparison or search until those surfaces exist.
- No new programme authority or status document. This brief is the handoff.

## Acceptance criteria for the backend

1. A lawyer can flag a specific component, role, span, value, link or
   coverage gap with an error class, cause, severity and expected correction.
2. The aggregate view reports rates with denominators by family, model,
   prompt, schema and generation.
3. A confirmed error can be promoted to a regression case and then marked
   verified only after a generation passes it.
4. Publishing remains atomic and release-scoped; feedback never edits a
   published fact.
5. The base app still presents facts as correct and has no review entry
   point.
