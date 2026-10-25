# Corpus: PW design direction, compare screen

**Status:** static visual comp, 23 October 2026. This is a design artifact, not
product code. Nothing in `pages/`, `components/` or `styles/` has changed.

## Files

- `corpus-pw-compare-2026-10-23.png`: compare, 1600 × 1200 at 2×.
- `corpus-pw-compare-mobile-2026-10-23.png`: mobile compare board, two 390 × 844
  frames at 2×. Left: the deal table. Right: the sections sheet.
- `corpus-pw-index-2026-10-23.png`: the deal index, 1600 × 1200 at 2×.
- `corpus-pw-review-2026-10-23.png`: the review screen, 1600 × 1200 at 2×.
- `corpus-pw-mobile-index-review-2026-10-23.png`: mobile board, two 390 × 844
  frames at 2×. Left: the index. Right: the review.
- `corpus-pw-compare.html`, `corpus-pw-mobile-board.html`, `corpus-pw-mobile-index-review.html`,
  `corpus-pw-index.html` and `corpus-pw-review.html`: static comp sources, for
  editing the comp, not for wiring into the app.

All deal names, numbers and clause text are illustrative. The comp is not legal
advice.

## What changed in this revision

### Desktop

- **More room for the deal.** The table is now 210px provision / 350px your deal /
  the rest for the reference set. The provision column came in, the deal column
  went out, and the reference column narrowed. The deal summaries now sit on one
  line.
- **A smaller reference-set card.** The rail's 14 is 40px rather than 46px.
- **A quieter, clearer set bar.** The row of preset pills, two selects and a save
  link is gone. It is replaced by one bar: the set name, the count, the
  composition, and two explicit actions, **Adjust set** and **Filter 2**. The set
  definition is readable at a glance and the detailed controls live one click
  away.
- **Adjust set** opens the reference-set drawer: whole corpus, Biotech, Barshay,
  $1bn+, year range, structure.
- **Filter** opens the provision filter, with the active count on the button. The
  comp shows the collapsed state so the table stays quiet.
- The left rail's reference card also says **Adjust set**, so the route is visible
  from either place.

### Mobile

The old mobile comp was one large provision card and a market panel. It showed
too little of the deal. It is replaced by a full-width table.

- **A 44px top bar.** The tile, Corpus, search and menu. No large page title block.
- **A compact deal header.** Northstar / Aria at 22px, then the stock, value, set
  count and date. The long lede is gone.
- **A three-column table:** provision, your deal, market. Nine provisions fit on
  the first screen, with a Show all 12 link. No horizontal scroll.
- **A bottom bar:** a Sections button and a Filter button. Sections opens the
  bottom sheet; Filter narrows the rows.
- **The sections sheet:** all 12 sections, the active Termination, reference links,
  a 12 / 2 / 14 summary and an Adjust set button. Switching sections keeps the
  same reference set and filters.
- **A row tap** opens the words and the full market read for that provision. It is
  the same content as the desktop right-hand panel, as a sheet.

### Options considered for mobile

- **Cards.** The previous comp. It reads well but shows one provision at a time
  and pushes the deal detail off the screen. Rejected.
- **A single-column accordion.** Hides the reference set and the comparison until
  tapped. Rejected.
- **Horizontal swipe between columns.** Not discoverable, and it breaks the one
  scale comparison. Rejected.
- **A full-width table with a bottom section switcher.** Chosen. The deal is
  visible, the market read stays in the row, and the sections are one thumb tap
  away.
- **A row detail sheet.** The next layer inside the chosen option; tapping a row
  opens the quote and distribution.


## Index

The index is the site's front door, so it is a full-width page with no rail and
no marketing block.

- One page title, then the search. The lede, the counts line and the navy stats
  band were removed; the 148 count lives with the table title and filters.
- One large search, no chips. The filters live under the table title, where they
  can be read and hit.
- The table is the page: deal, signed, value, structure, target counsel, acquirer
  counsel, PW role, status. Published is an outline pill; In review is the only
  filled one. Structure is an outline pill. This keeps the right edge quiet.
- A filter row, not a tiny count: All, Biotech, $1bn+, Has PW role and More
  filters, with Save view on the right. The pills are 10.5px on desktop and 9px
  on the phone, with a 32 to 34px tap.
- Twelve rows on the screen, then Load more. Every row opens on its clauses.
  No cards, no dashboard.

## Review

The review screen keeps the same rail and right panel as the comparison.

- The top is the deal name once, then the section. The breadcrumb, the reviewer
  line and the repeated section line were removed as duplicate text.
- The rail is the deal's sections, with a review-progress card in place of the
  reference set: 7 of 12 reviewed, 2 unresolved, 2 held.
- The main column is fact cards, not a long unfiltered list. Each card has the
  model proposal, the statement in the serif, a roles grid, the source words and
  the decision.
- Decisions are monochrome: Accept is filled navy; Edit, Reject and Unresolved
  are outline or text. Accepted is a filled pill; pending is outline.
- A held fact is the one exception: a muted amber callout, because it is a
  data-quality fault, not a legal meaning. It says what is held and why, and it
  opens the held fact.
- The right panel is the source: the exact words, the review trail, coverage and
  the method note. No market distribution here.
- The top actions are Save progress and Finalise candidate. The release candidate
  is labelled; it is not the active release.

## The PW layer

- **Masthead.** A light masthead, not a dark app bar. A stacked wordmark tile,
  Corpus, a serif nav, a quiet search field.
- **Colour.** Navy `#03203d`, blue `#0b3d71`, steel `#5d7da3`, mist `#b9c8da`,
  wash `#f1f4f8`, rule `#dce3e1`, ink `#33475e`, grey `#6b7785`. White ground.
  No black, no warm accent, no green or red states.
- **Type.** Inter Tight for structure: headings, numbers, labels, table text,
  pills, buttons. Source Serif 4 for reading: summaries, the quote, the method
  note. Display type is tight, at about -0.05em.
- **Rules.** A 10px mist rule separates page sections. A 2px navy rule caps the
  table. Panels are square, with 1px hairlines, and no shadow.
- **Pills.** Pills are controls and states. A yes is a filled navy pill; a no is
  outlined; a difference is a small navy square and the word Differs.
- **The big number.** The market read is 3.0% at 82px, with a serif caption.
- **The quote.** A wash panel with a 6px navy left border, in the serif, with the
  section, page and byte count.
- **Whitespace.** Table text is 13–14px, not 8px. Supporting notes are 10–12px.

## What stays

The product's grammar is intact: the section rail, the reference set as a
first-class object, reference set / two deals / summary modes, the provision-first
table, difference flags, the distribution, the source quote, export and the
method note. The comp removes no capability and adds no new claim.

## Decisions to confirm

1. **Light masthead with the PW tile and Corpus wordmark**, or Corpus-only. The
   tile is a typographic placeholder; Marketing's official SVG replaces it before
   anything ships.
2. **Monochrome state pills.** Quieter and more PW, but some lawyers will expect
   a green/red read. The alternative is one navy accent plus a restrained amber
   for a genuine data-quality warning.
3. **The left rail as the deal's section index.** The alternative is a horizontal
   section strip under the masthead.
4. **A right-hand market panel** rather than an inline market column. It keeps the
   table at three columns and gives the distribution room.
5. **1600px comp.** The layout is drawn at 1600 to keep the dense table legible.
   Check at 1440 and 390 before build, with the rail and panel allowed to collapse.

## Mobile

Three boards are drawn: compare, and Index with Review.

- **Index:** the 44px bar, the page title, then the search. No hero, no stats
  band. The table is three columns, deal, value, status. Published is outline;
  In review is the only filled pill. A filter row sits under the table title:
  All, Biotech, $1bn+, Has PW role and More filters, at 9px and a 32px tap.
- **Review:** the deal name once, then the agreement. The reviewed progress bar is
  gone; the section heading is 17px and carries the place. The list is the whole
  agreement, with section headings and the facts in order. More than one fact is
  visible; the page scrolls. There is no fact numbering in the lawyer surface;
  Fact 1, Fact 2 is an account/admin label only. Sections in the bottom bar opens
  the section sheet and jumps to the section.
- **Review detail:** rebuilt as a reading page in the order a lawyer reads it.
  The answer is under the title, then the summary, then the exact clause. The
  answer is the coded conclusion (3.0% of equity value); the summary is the
  model reading; the clause is the source. Key terms and the source cite follow;
  the review trail and a note sit behind Review details. Accept, Edit and more
  are in the bottom bar. Back returns to the same place in the agreement.
- **Compare:** the full-width table with the sections sheet, already drawn.

**Tap, not flick.** A row opens only on a tap or click. Track the pointer down
position; if it moves more than 8px before release, cancel the open. No
navigation on a scroll gesture. Give the row a pressed state, and support Enter
and Space on the focused row.

The mobile review text is larger than the first pass: the fact statement is
12px, the detail statement 15.5px, the labels 7.5 to 9px. The index rows are
11.5 to 12px. Nothing in the list is below 7px except the small meta labels.

## Next, after sign-off

Apply the same masthead, rules, type and pill vocabulary to the Index and the
Review page, then check the compare screen at 1440 and 390. The market numbers in
the comp are illustrative; production must carry the real `n`, the reference-set
definition, the release date and the exact source words.

## Review workflow page, 23 October 2026

`corpus-pw-review-workflow.html` is the workbench counterpart to the lawyer
preview. It uses the Andor / Apogee facts from the saved preview page:

- The three columns are the section rail, the fact cards and the source
  panel. The rail carries the deal, the sections and the run progress; the
  source panel follows the selected card.
- Cards are pending, accepted or held. The decision row is Accept, Edit,
  Reject, Unresolved. A held fact is a quiet amber block with its reason and
  a link to review it.
- The header keeps the deal title, the section context, the lawyer preview
  link, Save progress and Finalise candidate.
- No fact numbers appear in the lawyer surface.

The page is a standalone design page, not yet the live
`/review/product/[id]` route. That route still uses the old single-column
workspace and needs a run to verify a layout swap.

Screenshot: `corpus-pw-review-workflow-2026-10-23.png`.

## The review workflow, 23 October 2026

The card page was the wrong shape. It asked a lawyer to approve a sentence
without showing the text or the reasoning that produced it. The new page
turns review into four reading steps:

1. **The clause.** The exact words are the main surface, not a side panel.
   Party, action, object, effect and unclaimed qualifiers are underlined or
   washed in place.
2. **The components and roles.** Each extracted component sits beside the
   words it came from and the role it plays. A component the model did not
   claim is visible as a gap, not silently absent.
3. **Normalized values.** Amounts, dates, thresholds and periods are shown
   separately, so the lawyer can check the number and its trigger.
4. **The conclusion.** The fact is the conclusion of the chain. It cannot be
   confirmed while a component or qualifier is unclaimed. The action bar
   keeps the decision visible: confirm, edit, mark unresolved, comment.

The right panel is the assurance layer: source words, roles, conditions,
links, characterization and word coverage. The left rail holds the sections
and the facts in the current section. The fixed decision bar exposes the gap
first: **1 gap · DGCL qualifier**, with Confirm disabled until the gap is
resolved.

Page: `corpus-pw-review-reading.html`.
Screenshot: `corpus-pw-review-reading-2026-10-23.png`.

The live `/review/product/[id]` is still the card form. This page is the
specification for replacing it.
