# Compare build: design decisions

**From:** the PW redesign chat
**To:** the compare / market-position build
**Date:** 23 October 2026
**Status:** design decisions, not code. I have not edited anything in
`integration/`.

The integration draft and adjust drawer are in the right system. Below are the
answers, plus three corrections to the states you drew.

## 1. Draft: a modal, not a page

Keep the **centered 760px modal** over a scrim. Do not add a route.

- The draft is an input to the comparison, not a destination. The lawyer needs
  the table, the set and the market read behind it while pasting a clause.
- A page breaks that context, and the draft is short enough for a modal. If a
  full-document editor later needs long-form editing, annotations or
  collaboration, that can become a page; not in this slice.
- The modal is a task surface, so it is centered. The 440px right drawer is
  reserved for Adjust set, which is a panel over the comparison.
- Give the modal the 10px mist top rule. The integration modal currently starts
  with a white edge and a small shadow. Remove the shadow; the scrim is enough.
- Keep the header, the Specific provisions / Full document tabs, the paste area,
  the provision and set line, the confidentiality note and the footer. The
  confidentiality note is a PW callout: wash background, 6px navy left border,
  not a bordered box.
- Change the footer line to **14 deals in the reference set** (the draft is not
  a deal in the set).

## 2. Adjust: a right drawer, not inline

Keep the **440px right drawer**. Inline controls would push the table down and
make the screen busy; the drawer keeps the comparison visible and makes the set
feel like an object.

- Remove the drawer's drop shadow. Use the scrim and a 1px `--rule` edge, or a
  10px mist top rule. PW has no drop shadows.
- The drawer is the **reference set** surface. **Adjust set** opens it.
- **Filter** should not open the same drawer. It is a different scope: it
  filters the provision rows, not the set. Open a compact **provision filter
  popover** under the button, with: Differences only, Section, Text, Has
  market read. The `2` on the Filter button is the count of those row filters.
- If you would rather have one surface, add a **Provisions** tab to the drawer.
  I would keep them separate: the set is a saved object, the filter is a
  transient view.
- The drawer's fields are right: years, deal value and custom minimum, industry,
  lawyer, structure. Public/private and sponsor/strategic can be added in the
  same section later; do not expand it now.
- The footer actions are right: Apply to set, Save as new set, Reset. Make
  **Apply to set** the only navy button. Save and Reset stay text or outline.

## 3. Two deals: the right panel becomes Both clauses

Two deals is a different reading, not a market read. Do not keep the market
distribution, the median, the `n` or the In the set block.

**Table.**
- Columns: Provision / Deal A / Deal B. The reference column is removed.
- The set bar becomes a deal picker: Deal A (Northstar / Aria), a swap control,
  Deal B (Choose a deal). Differences only stays.
- The left rail keeps the section index. The reference-set card is replaced by
  "2 deals" or hidden; there is no set.
- The difference markers move to the A and B cells. A row that only one deal
  answers is `Only in A` or `Only in B`, never a blank.

**Right panel.**
- Header: "Deal A vs Deal B", then the provision title and section.
- Two stacked quote cards, A then B. Each has the deal name, the section and
  page, and the exact words. Use the same wash callout, 6px navy left border.
- A **What differs** block under the quotes: one line per differing cell, e.g.
  Fee 3.0% vs 3.5%, Tail 12 months vs 18 months, Sole remedy Yes vs No. 1px
  rules, 11px sans labels, no colour.
- No distribution, no median, no options, no `n`. A two-deal comparison has no
  market position.
- If Deal B is not chosen, the panel is an empty state: "Choose a second deal
  to read both clauses", with the deal picker.
- If the two deals come from different table shapes or vocabulary versions,
  show "Not comparable" with the reason. Do not invent a row.

**Mobile.** Two deals uses two deal columns instead of deal plus market; the
panel becomes a full-screen Both clauses sheet. The sections sheet stays.

## 4. Class ownership

**Yes, the compare classes are frozen for this iteration.** I will not rename
one without adding a note here and to `integration/COORDINATION-NOTE-2026-10-23.md`.
The tokens and type are the real contract; the classes are a convenience.

Two conditions.

1. **Scope them.** These are comp class names, not a global API. Use a `.cmp`
   wrapper, a CSS module, or a prefix in the component. Do not let `.top`,
   `.body`, `.main`, `.panel`, `.rail` or `.drawer` become global selectors.
2. **Retire the old filter classes.** `.filters`, `.fpill`, `.fselect`, `.save`
   and `.sep` were the old busy filter row and are **not in the current comp**.
   The current set bar is `.setbar`, `.setname`, `.setcount`, `.setcomp`,
   `.setbtn`, `.filterbtn`, `.fcount`. Do not build on the retired names.

The current base classes are:

```
.artboard .top .brand .tile .bname .nav .search .who .help
.context .ctxleft .crumb .meta .actions .btn .btn.solid .btn.ghost .linkarrow
.toprule .body .rail .raillabel .railref .railnote .main
.modes .mode .check
.setbar .setname .setcount .setcomp .setactions .setbtn .filterbtn .fcount
.table .thead .trow .cell .provname .sec .diff .dealv .dealsum .words
.pill .pill.solid .pill.line .pill.mut
.mhead .bar .bar.m .mnote .showall
.panel .ptop .pk .ptitle .psub .psec .stat .cap .marketline .dist .distlegend
.block .bh .opt .opt.you .quote .src .pactions .method .legal
```

The state classes you added are yours to keep: `.drawer` (adjust), `.sheet`
(draft), `.exportmenu` (export). One collision: `.sheet` is also the mobile
sections sheet in my board. Rename the draft one to `.draft-modal` or scope both
under different parents. Do not use one `.sheet` for both.

## 5. Export

A **small menu** under the Export action, not a page. Word, Excel, CSV. Each
item says what it contains. No route, no modal.

## 6. Mobile: Draft and Adjust

Both are **full-screen sheets**, not the desktop drawer or modal.

- Draft: a full-screen sheet with a 44px top bar, Close, the paste area, the
  provision and set line, the confidentiality note and a sticky "Compare this
  draft" button. The compare table stays behind the scrim.
- Adjust: a full-screen sheet with the same fields, a sticky "Apply set" and a
  Close. It replaces the rail; there is no drawer on a phone.
- Filter: a bottom sheet, with the same row filters.
- Sections stays the bottom bar / sheet already drawn.
- The mobile table keeps three columns in reference-set mode. In two-deal mode
  the third column becomes Deal B, and the market column disappears.

## 7. Monochrome and warnings

Stay monochrome for legal meaning. No green, red or amber on a state, a
difference or a market label.

If a genuine data-quality warning is ever needed, use one restrained amber
callout outside the table, with dark text, and only for a data fault. A small
sample is not a warning: show `n`, the composition and the range as text, and
proceed. This matches your no-trigger rule.

## Three corrections to the integration states

1. Remove the drop shadow from the adjust drawer and the draft modal. Use the
   scrim and a 1px rule or the 10px mist top rule.
2. Give the draft modal and the adjust drawer the 10px mist top rule so they
   read as PW panels.
3. Keep Adjust set and Filter separate. The drawer is the set; the popover is
   the rows. If you consolidate, use tabs, not one ambiguous form.

## What I am doing next

The Index and Review screens in the same system, as comps. I will not touch the
integration files.
