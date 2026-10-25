# Compare and market position: coordination with the PW redesign

**From:** the compare / market-position build
**To:** the "I want you to redesign" chat
**Date:** 2026-10-23
**Status:** coordination note. I have not edited your files.

## What I read

- `reports/mockups/corpus-pw/corpus-pw-compare-2026-10-23.png`
- `reports/mockups/corpus-pw/corpus-pw-compare.html`
- `reports/mockups/corpus-pw/corpus-pw-compare-mobile.html`
- `reports/mockups/corpus-pw/DESIGN-NOTES.md`

Your comp is now the visual source of truth for this screen. The earlier
black-rail compare mockups are functional references only; they are
superseded visually.

## What I will reuse exactly

| Element | Classes | Use |
| --- | --- | --- |
| Masthead | `.top`, `.brand`, `.tile`, `.bname`, `.nav`, `.search`, `.who`, `.help` | The page shell |
| Context | `.context`, `.crumb`, `h1`, `.sub`, `.meta`, `.actions`, `.btn`, `.linkarrow` | Deal, provision, meta, actions |
| Section rule | `.toprule` | The 10px mist rule |
| Rail | `.rail`, `.raillabel`, `.railref`, `.railnote` | Sections and the reference set |
| Modes | `.modes`, `.mode`, `.check` | Reference set / Two deals / Summary |
| Set bar | `.setbar`, `.setname`, `.setcount`, `.setcomp`, `.setbtn`, `.filterbtn`, `.fselect`, `.fpill`, `.save` | The reference set and its adjustments |
| Table | `.table`, `.thead`, `.trow`, `.cell`, `.provname`, `.sec`, `.diff`, `.dealv`, `.dealsum`, `.words`, `.pill`, `.mhead`, `.bar`, `.mnote`, `.showall` | Provision, deal, set |
| Right panel | `.panel`, `.ptop`, `.pk`, `.ptitle`, `.psub`, `.psec`, `.stat`, `.marketline`, `.dist`, `.block`, `.opt`, `.quote`, `.pactions`, `.method`, `.legal` | Market position, distribution, options, quote |
| Buttons | `.btn`, `.btn.solid`, `.btn.ghost` | Actions |
| Pills | `.pill`, `.pill.solid`, `.pill.line`, `.pill.mut` | States and controls |

**Tokens.** Navy `#03203d`, blue `#0b3d71`, steel `#5d7da3`, mist `#b9c8da`,
wash `#f1f4f8`, rule `#dce3e1`, ink `#33475e`, grey `#6b7785`, white.
**Type.** Inter Tight for structure, Source Serif 4 for reading.
**Rules.** 10px mist section rule, 2px navy table cap, square panels, no
shadows, no green, red or amber for legal meaning. Pills are controls, not
decoration. The firm is "Paul, Weiss", with the comma.

## What your comp does not show yet, and what I added

I added only the states the comp does not draw. They use your classes and
tokens; the files are in this folder.

1. **Draft a clause** (`.sheet` modal, 760px): the "Draft a clause" action
   opens a sheet with Specific provisions / Full document, a paste/upload
   area, the provision, the reference set, a confidentiality note (stored
   under the user's account with a delete action; never in the corpus), and
   "Compare this draft".
   - `corpus-pw-integration-draft-2026-10-23.png`
2. **Adjust set** (`.drawer`, 440px): years, deal-value pills plus a custom
   minimum, industry, lawyer, structure, the set summary, Apply / Save as new
   set / Reset.
   - `corpus-pw-integration-adjust-2026-10-23.png`
3. **Export** (a small menu under the Export action): Word (table plus a
   schedule of the full section text), Excel (comparison, provisions,
   reference set), CSV (one row per point).
4. **Two deals** is still undrawn. The mode pill exists; the second column
   and the both-text treatment of the right panel are the main open design
   question.

The integration file is
`corpus-pw-compare-integration-2026-10-23.html` (hash `#draft` and `#adjust`).

## Decisions I need from you

1. **Draft: a modal or a full page?** I assumed the modal at 760px. If it
   should be a page, the route is `/compare/draft`.
2. **Adjust: a right drawer or an inline panel under the set bar?** I assumed
   the 440px drawer. The set bar's "Adjust set" and "Filter" both open it.
3. **Export: a menu or a page?** I assumed a small menu under the Export
   action, because the export is three formats and one table.
4. **Two deals: what happens to the right panel?** The reference-set panel
   becomes a both-deal panel: both clauses, the differences, and no
   distribution. I need your treatment of the second column and the panel.
5. **Mobile:** the mobile comp has no rail or right panel. Where do Draft and
   Adjust live on a phone? A full-screen sheet is the obvious answer; I have
   not drawn it.
6. **Class ownership:** can I depend on the class names above? If you rename
   one, tell me and I will mirror it in `components/product`.
7. **Monochrome states:** the no-trigger rule means there is no
   "small sample" warning; the sample size is shown as text. If a genuine
   data-quality warning is ever needed, do you want one restrained amber, or
   stay monochrome?

## Content rules I bring

- **Provision first.** One row per provision; the deal's answer, the set's
  answer, the words.
- **The lawyer picks the reference set.** Prebuilt by industry, lawyer and
  size; adjustable bands; saved sets; two deals.
- **No small-sample trigger.** Show `n`, the composition and the range
  always; no threshold that suppresses or flags the label.
- **The lawyer field is the notice section.** `lib/parser-v2/notice-advisors.js`
  captures each side's firm and the "Attention:" lawyers; any deal from that
  lawyer.
- **Draft with a delete action.** Stored under the user's account; never in
  the corpus or a market count.
- **Export.** Word table plus full-section schedule; Excel three sheets; CSV
  one row per point.

## Paste this to the redesign chat

> Compare/market build here. I read your comp and DESIGN-NOTES and I am using
> your tokens and classes. I added only the states your comp does not show:
> the draft clause modal, the adjust-set drawer and the export menu. Files:
> `reports/mockups/corpus-pw/integration/`. Please confirm (1) draft as a
> modal or a page, (2) adjust as a drawer or inline, (3) how Two deals treats
> the right panel, (4) whether I can depend on your class names. I have not
> edited your files.
