# Index implementation

**Status:** first implementation slice, 23 October 2026.
**Branch:** `design/corpus-pw-index-review`
**Worktree:** `/Users/bengoodchild/Desktop/Corpus-pw-redesign`
**Head:** `f85aa459`
**Base:** `4ecc7be8`, the same base as the comparison build.

## What landed

- The PW masthead: stacked Paul, Weiss tile, Corpus wordmark, Index and Library,
  Login. The tile is the typographic placeholder; Marketing's SVG still replaces
  it before release.
- Inter Tight and Source Serif 4, self-hosted in `public/fonts/pw/`.
- The index title, then the search. No hero block, no stats band.
- The 40-deal table, restyled: 2px navy cap, square rows, tabular numbers,
  quiet rules. The existing column sorting, column filters and column picker are
  unchanged.
- A real filter row: All 40, Biopharma 9, $1bn+ 32, Paul Weiss 24, More filters.
  The counts come from the 40-deal home snapshot; the presets write the existing
  `filters` state, so they compose with the column menus and the URL.
- More filters opens a 430px drawer with every filterable column and its options.
  Clear all, Done, Escape to close, and a scroll lock while it is open.
- Mobile: 64px masthead, 32px title, 46px search, filter row that wraps, and a
  three-column table (Deal, Signed, Value). Dates switch to short form; the
  column picker is hidden on the phone. The extra columns are hidden below 820px.

## Verification

- `npm run build` passes on Node 20. The Node 24 runtime cannot load the Next
  14.2.21 SWC binary on this machine (code signature), so the preview and build
  use the Node 20 tarball at `/tmp/node-v20.19.0-darwin-arm64`.
- Browser check at 1440 and 390. No console errors.
- Biopharma preset tested: 9 rows and `?f_sector=Biopharma`.
- More filters panel opens, scrolls and dims the table.
- The comparison build's files are untouched. The main worktree remains on its
  branch; this work is in the separate worktree above.

## Limits to fix next

- The table header is not sticky. A sticky header with a page-level top offset
  rendered over the first row in Chrome; it is static for now.
- The phone shows the first three columns only, and the column picker is hidden
  there. A mobile column choice is a follow-up.
- Review is not implemented yet.
- The filter drawer does not trap focus; Escape and the scrim work.

## Run

```
cd /Users/bengoodchild/Desktop/Corpus-pw-redesign
PATH=/tmp/node-v20.19.0-darwin-arm64/bin:$PATH \
  SESSION_SECRET=<32+ chars> AUTH_USERNAME=ben AUTH_PASSWORD=<password> \
  npm run dev
```

Sign in at `/login`. The home page reads the generated 40-deal snapshot, so it
needs no database.

## Screenshots

- `implementation/index-1440.png`
- `implementation/index-390.png`

## Lawyer preview / provisions, 23 October 2026

**Commit:** `2d6ef17b`

The `/review/product/[id]/provisions` page is restyled in the same PW
system, using the saved Andor / Apogee page for the visual check:

- The black rail is now a light 264px column with a navy right rule, the
  Paul, Weiss tile and Corpus wordmark, and Source Serif section links. The
  active section is a wash block with a navy 3px left rule.
- The header keeps the eyebrow, state badge and title, now with a 10px mist
  rule instead of the 2px black rule. The title is 38px on desktop.
- Section cards are square, with a 10px mist cap and a wash header band.
  The green and blue tints are gone; pills are outline/wash in navy.
- Table captions use a navy baseline, 9px caps and 10px cell padding.
- Evidence status pills use navy, mist and a restrained amber for pending.
- Inter Tight and Source Serif 4 now load globally from
  `styles/pw-fonts.css`; the page sets both through its font variables.

**Verification:** `npm run build` passes. `tests/product-provisions-preview.test.js`
and `tests/product-provision-tables.test.js` pass (59 tests). The visual is
`implementation/provisions-1440.png`, rendered from the saved page with the
same class overrides; there is no live run in the local database to render
the React page against. The comparison build is untouched.

## Review workbench, 23 October 2026

**Commits:** `4899214e`, `3a9b6199`, `ebba7f65`

The live `/review/product/[id]` route now has the workbench layout:

- A three-column grid inside the page: section rail, review main, source
  panel. The rail is sticky, lists every agreement section with its
  reference and pending count, and carries the run's pending and unresolved
  totals.
- The source panel is inline on desktop. Clicking a fact or citation loads
  the exact selected span there, with a **Full source** button that opens
  the existing modal. On phones the modal opens directly, as before.
- Proposal cards are square with a 10px mist cap, a 21px statement, role
  labels, save/decision pills, and the PW status badge. The green, blue and
  red decision buttons are now navy and mist pills.
- The page header is the deal title, the run state, the section and pending
  counts, the lawyer preview link, Save progress and Finalise candidate.
- The shared `components/chrome/TopBar.jsx` is now the PW masthead: Paul,
  Weiss tile, Corpus wordmark, Index, Compare, Review, Library, account.
  It applies to every page that still uses `Layout`.

**Verification:** `npm run build` passes. The non-database review UI tests
pass (32 tests). `tests/product-review-*-db.test.js` and the two other
database suites need `TEST_DATABASE_URL` or `TEST_PGLITE_MODULE`; they fail
before rendering, and are not UI failures.

**Visuals:**

- `implementation/review-workbench-1440.png` and
  `implementation/review-workbench-390.png` are rendered from the real
  `DraftReview`, `ReviewSectionRail` and `ReviewSourcePanel` with a
  fixture workspace and the compiled app CSS.
- `corpus-pw-review-workflow-2026-10-23.png` is the polished design page
  with the Andor / Apogee facts.

The live route could not be loaded against a stored run: the preview
deployment is still behind Vercel Authentication. The layout is therefore
checked from real component renders, not from a stored run.

### Review workbench polish, 23 October 2026

**Commits:** `807e7ef0`, `51d608bb`

- The summary-group control is now inside a collapsed **Review details**
  disclosure, so the card leads with the statement, roles and decision.
- The rail tracks the section in view with an IntersectionObserver; anchor
  jumps leave room for the sticky header.
- The shared masthead links only to routes that exist on this branch:
  Index, Review and Library. The production comparison route is not in
  this worktree yet.
- The review page now sits under the 76px PW masthead; the sticky review
  header starts at 76px and the rail and source panel at 192px.

**Verification:** `npm run build` passes; the non-database review UI tests
pass. The `/review` index was opened in the browser with the new masthead
at 1440. The review workbench itself is shown from the real components with
a fixture at 1440 and 390.

## Base app, 23 October 2026

**Branch:** `design/corpus-pw-base`
**Head:** `3b16978a`

The base app now presents the data as correct:

- `/` is the PW deal index.
- `/review/product/[id]/provisions` is the read-only lawyer preview.
- The shared masthead links Index and Library only. There is no Review link.
- No review methodology, feedback chain, review navigation or quality
  backend is in the base.
- The review workbench and the reading page are parked on
  `design/corpus-pw-index-review` for after comparison and search. The
  backend brief is `REVIEW-BACKEND-HANDOFF.md` for the codex manager.

The review implementation notes above describe that parked branch, not the
base app.
