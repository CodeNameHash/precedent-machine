# DeepSeek work package 3: a page lawyers can use (2026-11-01)

For the DeepSeek agent. Read this, then work packages 2 and 3 in order on
one branch. The manager reviews at its next session and merges when green.

## State

- PR 490 (package 1) is merged into `codex/product-implementation-plan-20260904`
  at d0d45a94, with two fixes on top: held facts now reach the comparison
  view, and how-common gives one distribution per row, parent row and
  column. Close the PR if GitHub has not.
- Package 2 (`DEEPSEEK-WORK-PACKAGE-2-COMPARE-2026-11-01.md`) stands:
  market line under each answer, "How this compares" in the sidebar,
  "Everything" mode. Build it first.
- Branch: `deepseek/lawyer-use-20261101` off the product branch. One PR back
  to it. Never force-push. Plain commit messages, no model names. No
  secrets. Product database only through existing server helpers. Never
  touch the V1 project `tzulhdasmioeechxapdy`. Reply in
  `docs/codex-program/notes/DEEPSEEK-LAWYER-USE-2026-11-01.md` only.

## Ownership (no overlap)

You own: `components/product/ProvisionTables.jsx`, `EvidenceSidebar.jsx`,
`PublishedSummary.jsx`, `ReviewWorkspace.jsx`, `FocusedReview.jsx`,
`ProvisionRail.jsx`, `components/chrome/PwBar.jsx`,
`pages/review/product/[id].js`, `pages/review/product/[id]/provisions.js`,
`pages/deals/v2/[id].js`, the new feedback and account files below, and
their tests.

The manager owns `lib/product/table-view.js`, `lib/product/fact-conclusions.js`,
`lib/product/agreement-draft.js`, `scripts/product/*`,
`contracts/product/*`. If you need a field on a built cell, write the
request in your note; do not change those files.

## Ben's words (verbatim) and what each becomes

### A. The provisions page

1. "On the other provisions - try and match the first colun width of the
   section they're in (e.g. structure and mechanics)." The Other provisions
   table uses the same colgroup as its parent table: first column 34%
   below md, 26% from md.
2. "Make the expand all adn collapse all buttons a bit more design-like -
   e.g. use blue." The toolbar buttons become pills in the page language:
   1px `#B9C8DA` border, `#0B3D71` text, white fill, navy fill with white
   text when pressed (`aria-pressed`), 12px Inter Tight 600.
3. "move show specifics into the title of each section. Also for things
   like reps or IOCs, have the more detailed language of each provisions
   pop out (and the 'more detail' rows)." Remove the page-wide Show
   specifics button. Each section heading gets a small "Specifics" pill at
   its right, before the chevron; it shows that section's specifics columns
   and opens every More detail / Exceptions group in the section. Keep the
   page-wide Everything (package 2) as the one control that opens all.
   Ben's model: "adding in the extra column on antitrust/regulatory when
   you click the show details is the sort of behaviour I want."
4. "if you click an item in the right hand menu the main page should jump
   to it AND open that item. Make sure the item isn't hidden by the
   header." A rail or Sections-menu click expands the section if it is
   collapsed, then scrolls to it. Give every section `scroll-margin-top`
   equal to the PwBar height plus 12px (70px). The rail marks the section
   in view as active (IntersectionObserver).

### B. The review page

"the review page as it is now is kind of useless. When you click it, it
completely changes the design of the site ... Make sure it looks like the
rest of the site. That review page should basically give you all the
answers that we have. It should start by showing the key ones exactly the
same way that the existing site does. Then, above and below each one, you
should click a button and say 'See reason.' It should give you the text of
the provision and maybe the interpretation tree, so you can review it and
say yes, no, comment, or whatever."

Rebuild `/review/product/[id]` as the provisions page in review mode: the
same rail, PwBar, header and tables (render `PublishedSummary` /
`ProvisionTables` with a `mode="review"` prop). In review mode every
answer line carries a quiet "See reason" control (same QUIET style as "See
provision"). It opens, inline under the row, a panel with the source text
of the cited words, the interpretation tree, and three actions: Agree,
Disagree, Comment (a text box). These write through the existing review
API the current ReviewWorkspace uses (read it; reuse its save calls and
state machine, do not invent a new decision store). Keep the old workspace
reachable at `/review/product/[id]?legacy=1` until Ben retires it.

### C. Feedback anywhere

"On the normal page, if you're not on the review page, if something looks
wrong, there should be a report button, feedback, or something somewhere
... There should be an admin page that I can review ... Make sure we track
who the inputter is ... if someone's on the site and they're moving around
and they have feedback, they should be able to give it in place, and we
should track where it is. That might not just be how the interpretation
works. There might be things: something's missing or something's wrong."

- A "Feedback" control in the evidence sidebar header for the selected
  cell, and a small "Report" link at the end of each section heading.
- One form: kind (Wrong answer / Missing / Unclear / Other), free text.
  It records automatically: run id, page path, section key, table key, row
  subject, column id, the cell's code and label, fact ids, the user and
  their level, and the time.
- Storage: a new table `product_feedback` (migration file under
  `supabase/migrations/`, timestamp after the latest). Columns: id, created_at,
  run_id, page_path, section_key, table_key, row_subject, column_id,
  cell_code, cell_label, fact_ids jsonb, kind, body, author_id, author_name,
  author_level, status (`open` / `accepted` / `rejected` / `done`),
  resolved_by, resolved_at, resolution_note. Write the migration; do not
  apply it. The manager applies it.
- API: `POST /api/product/feedback` (signed-in only), `GET` and `PATCH`
  for the admin page (admin only).
- Admin page `/admin/feedback`: the list, filters by status, deal, level
  and kind, each item linking back to the exact place (path plus
  `#provision-section-<key>`), and Accept / Reject / Done with a note.
  Same visual language as the provisions page.

### D. Reviewer levels

"There should be different levels of reviewer. If it's a partner or a
senior associate, they should be allowed to edit in ... the system almost
assumes it's correct. I think we do a once-a-week pass ... but don't build
that into the automatic thing yet ... create an account structure where
it's like partner, senior associate, mid-level associate, junior associate
... build real names, and in the future, have a little toggle in the top
right of the screen for which one you are."

- A `product_reviewers` table (same migration): id, name, level
  (`PARTNER` / `SENIOR_ASSOCIATE` / `MID_LEVEL_ASSOCIATE` /
  `JUNIOR_ASSOCIATE`), email, active. Seed: Ben Goodchild as PARTNER only;
  Ben adds the rest.
- A reviewer switcher at the right of PwBar ("Reviewing as: Ben
  Goodchild · Partner"), stored in a cookie, read by the feedback and
  review APIs. It is not authentication; the session login stays as it is.
- Partner and senior associate feedback is stored with
  `author_level` and flagged `trusted: true` in the API response. Nothing
  changes a fact automatically yet; the weekly pass is manual.

## Tests and checks

node:test + assert/strict for the feedback API (POST 201 / 400 / 401,
GET / PATCH admin-only), the reviewer cookie reader, review mode render
(See reason present, panel content), the section Specifics pill, the
scroll-margin, and the Other provisions colgroup. Add every new file to
`test:active`. Run `npm run test:active` (known failures: "Codex client
uses one private final-message file" and the health-route assertion) and
report counts in your note. Put 1400px and 390px screenshots of the
provisions page, review page and admin page in the PR.
