# DeepSeek work package 3: a page lawyers can use, 2026-11-01

A dated work package note, not a plan authority. The executable checklist stays
`docs/codex-program/notes/PRODUCT-LAUNCH-IMPLEMENTATION-PLAN-2026-09-04.md`.
This branch builds package 2 (compare in the page; its own note is
`DEEPSEEK-COMPARE-IN-PAGE-2026-11-01.md`) and package 3 together, as asked.

## Branch

`deepseek/lawyer-use-20261101`, cut from
`codex/product-implementation-plan-20260904` at `0432f8d2` (package 1 and the
PR 490 merge fixes are in that base). One PR back to it. No force-push, no
secrets, no V1 project access.

## A. The provisions page

- The Other provisions table uses the parent table's colgroup: 34% first
  column below md, 26% from md.
- The toolbar buttons are pills in the page language: mist border
  (`#B9C8DA`), blue text (`#0B3D71`), white fill, navy fill with white text
  when pressed; 12px Inter Tight 600.
- The page-wide Show specifics button is gone. Every section heading has a
  `Specifics` pill before its chevron; it shows that section's specifics
  columns and opens every More detail / Exceptions group in that section.
  The package 2 `Everything` toggle remains the one control that opens all.
- A rail or Sections-menu click dispatches `pm:open-section`; the target
  section is expanded and scrolled to, and every section carries
  `scroll-mt-[70px]` (58px PwBar + 12px). The rail marks the section in view
  as active with an IntersectionObserver.

## B. The review page

`/review/product/[id]` now renders the provisions page in review mode:
PwBar, rail, header, actions and the same built tables. Each answer row has a
quiet `See reason` control; it opens an inline panel under the row with the
provision text, the interpretation tree and Agree / Disagree / Comment. The
actions write through the existing `/api/product/review/[id]` POST and its
state machine (the same commands the old workspace used). The old workspace
is still at `/review/product/[id]?legacy=1`.

The review page is `components/product/ProvisionReview.jsx`; the row panel is
`ReviewReasonPanel` in `ProvisionTables.jsx`; `ProvisionTables` takes
`mode="review"`.

## C. Feedback anywhere

- An evidence-sidebar `Feedback` control and a small `Report` link at the end
  of every section heading open one form: kind (Wrong answer / Missing /
  Unclear / Other), free text. The form captures run id, page path, section,
  table, row, column, cell code/label, fact ids, and the API stamps the
  author, level and time.
- The API is `POST/GET/PATCH /api/product/feedback`. POST is signed-in and
  same-origin; GET and PATCH are owner-only. PATCH takes
  `open|accepted|rejected|done` plus a resolution note.
- `/admin/feedback` lists the feedback with status/level/kind/run filters,
  the exact page plus `#provision-section-<key>` link, and Accept / Reject /
  Done with a note. It uses the same PwBar and page language.
- The migration is written, **not applied**:
  `supabase/migrations/20261101000000_product_feedback_and_reviewers.sql`.

## D. Reviewer levels

- `product_reviewers`: id, name, level (`PARTNER`, `SENIOR_ASSOCIATE`,
  `MID_LEVEL_ASSOCIATE`, `JUNIOR_ASSOCIATE`), email, active. The migration
  seeds Ben Goodchild as PARTNER only; Ben adds the rest.
- `PwBar` shows `Reviewing as: <name> · <level>` at the right. It is a
  preference in the `pm_reviewer` cookie, not authentication; the session
  login is unchanged. `/api/product/reviewers` serves the active list and the
  resolved current reviewer.
- The feedback API reads the cookie and stores `author_level`; a partner or
  senior associate response is flagged `trusted: true`. Nothing changes a
  fact automatically.

## Files

New: `components/product/ProvisionReview.jsx`,
`components/product/FeedbackDialog.jsx`, `lib/product/feedback-handler.js`,
`lib/product/reviewers.js`, `pages/api/product/feedback.js`,
`pages/api/product/reviewers.js`, `pages/admin/feedback.js`,
`supabase/migrations/20261101000000_product_feedback_and_reviewers.sql`,
`tests/product-lawyer-use.test.js`.

Changed: `components/product/ProvisionTables.jsx`,
`components/product/EvidenceSidebar.jsx`,
`components/product/PublishedSummary.jsx`, `components/product/ProvisionRail.jsx`,
`components/chrome/PwBar.jsx`, `pages/review/product/[id].js`,
`pages/analysed/compare.js`, `tests/product-provision-tables.test.js`,
`package.json` (the new test in `test:active`).

Untouched, as package 3 requires: `lib/product/table-view.js`,
`lib/product/fact-conclusions.js`, `lib/product/agreement-draft.js`,
`scripts/product/*`, `contracts/product/*`.

## Tests

- `tests/product-lawyer-use.test.js`: 7/7 — reviewer cookie/levels, feedback
  POST 201/400/401, GET/PATCH owner-only, section specifics and colgroup,
  review-mode See reason panel, feedback form.
- `tests/product-compare-api.test.js`: 14/14; `tests/product-compare-in-page.test.js`:
  6/6; `tests/product-provision-tables.test.js`: 46/46.
- `npm run test:active` (run through Node's script runner; this machine has
  the node binary but not the npm shim): **1003 tests, 1003 pass, 0 fail, 0
  cancelled, 0 skipped, 0 todo** (`duration_ms` 316,047). The product CI job has not completed on the
  runner (a rerun was cancelled at test 471); both Vercel builds pass. The
  local suite is the evidence for this branch.

## Screenshots

The machine has no product database credentials or session, so the live
pages could not be reached. The screenshots are fixture renders of the real
components in a local `next dev`, captured at 1400 and 390 with Chrome:
provisions, review with the See reason panel open, and the feedback admin
list. The fixture data is representative, not live deals; the real browser
check against the deployment remains for the manager.

- `visual/deepseek-lawyer-use-20261101/provisions-1400.png`
- `visual/deepseek-lawyer-use-20261101/provisions-390.png`
- `visual/deepseek-lawyer-use-20261101/review-1400.png`
- `visual/deepseek-lawyer-use-20261101/review-390.png`
- `visual/deepseek-lawyer-use-20261101/admin-1400.png`
- `visual/deepseek-lawyer-use-20261101/admin-390.png`

## Handoff

- No new built-cell field was needed; the market line, reason panel and
  feedback context use the existing cell fields.
- Apply the migration before the feedback API or reviewer switcher can serve
  real rows; until then the reviewer reader falls back to the configured owner
  and feedback writes fail closed.
- The reviewer switcher is deliberately a preference, not authentication.
  The session owner check still governs the admin feedback list.
- The old `/compare` surface remains; package 2 recommends
  `/analysed/compare` as the comparison to keep when Ben decides.
