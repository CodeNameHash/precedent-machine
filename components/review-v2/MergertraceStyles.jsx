// Review V2 ("Mergertrace") — global CSS, every rule scoped under .mtx so
// nothing leaks into the v1 review page or the rest of the app. Two jobs:
//  1. Mergertrace tokens + typography for everything the v2 page renders.
//  2. Restyle the REUSED v1 ProvisionTable/primitives markup (which we must
//     not edit) so the embedded tables read native to the prototype:
//     sharp corners, 1px #E0E0E0 borders, #F6F6F6 header bars, Inter meta
//     labels, tint-on-tint rectangular pills.
// The repo's Tailwind theme resolves colors/fonts through CSS custom
// properties (--ink-rgb, --font-sans, ...), so redefining those variables on
// .mtx re-skins the reused components without touching their class names.

export default function MergertraceStyles() {
  return (
    <style jsx global>{`
      .mtx {
        /* ── Mergertrace tokens ── */
        --paper: #FFFFFF;
        --paper-2: #F6F6F6;
        --surface: #FFFFFF;
        --ink: #1F1F1F;
        --ink-mid: #1F1F1F;
        --ink-light: #6B6B6B;
        --ink-faint: #6B6B6B;
        --line: #E0E0E0;
        --line-soft: #E0E0E0;
        --accent: #1F1F1F;
        --accent-deep: #1F1F1F;
        --accent-soft: rgba(31, 31, 31, 0.06);

        /* RGB triplets consumed by the repo's Tailwind color classes */
        --paper-rgb: 255 255 255;
        --paper-2-rgb: 246 246 246;
        --surface-rgb: 255 255 255;
        --ink-rgb: 31 31 31;
        --ink-mid-rgb: 31 31 31;
        --ink-light-rgb: 107 107 107;
        --ink-faint-rgb: 107 107 107;
        --line-rgb: 224 224 224;
        --line-soft-rgb: 224 224 224;
        --accent-rgb: 31 31 31;
        --accent-deep-rgb: 31 31 31;

        /* Font stacks — the repo's font-ui/font-serif/font-mono classes all
           resolve var(--font-*), so this swaps Hanken Grotesk out wholesale. */
        --mtx-serif: 'Tinos', 'Times New Roman', Georgia, serif;
        --mtx-sans: 'Inter', Arial, ui-sans-serif, system-ui, sans-serif;
        --mtx-mono: 'IBM Plex Mono', ui-monospace, SFMono-Regular, Menlo, monospace;
        --font-serif: var(--mtx-serif);
        --font-sans: var(--mtx-sans);
        --font-mono: var(--mtx-mono);

        background: #FFFFFF;
        color: #1F1F1F;
        font-family: var(--mtx-sans);
        -webkit-font-smoothing: antialiased;
      }

      /* ── Own building blocks ── */
      .mtx .mtx-serif { font-family: var(--mtx-serif); }
      .mtx .mtx-mono { font-family: var(--mtx-mono); font-variant-numeric: tabular-nums; }
      .mtx .mtx-meta-label {
        font-family: var(--mtx-sans);
        font-weight: 700;
        text-transform: uppercase;
        color: #6B6B6B;
      }
      .mtx .mtx-doc-body {
        font-family: var(--mtx-serif);
        font-size: 13.5px;
        line-height: 1.75;
        color: #1F1F1F;
        margin: 0 0 12px;
        text-wrap: pretty;
      }
      .mtx .mtx-doc-ref {
        font-weight: 600;
        color: #1F1F1F;
      }
      .mtx .mtx-doc-defined {
        font-weight: 600;
        font-style: italic;
      }
      .mtx .mtx-scrollbar-thin::-webkit-scrollbar { width: 6px; height: 6px; }
      .mtx .mtx-scrollbar-thin::-webkit-scrollbar-thumb { background: #E0E0E0; border-radius: 0; }
      .mtx .mtx-scrollbar-thin::-webkit-scrollbar-track { background: transparent; }

      .mtx .font-mono { font-variant-numeric: tabular-nums; }

      /* ── Reused ProvisionTable, re-skinned ──────────────────────────── */

      /* Card: white, 1px #E0E0E0, sharp corners, no shadow. */
      .mtx [data-testid^='provision-table-'] {
        border-radius: 0 !important;
        border-color: #E0E0E0 !important;
        box-shadow: none !important;
        background: #FFFFFF !important;
      }
      /* Kill every rounded corner inside the reused tables (pills, chips,
         grouped sub-row cards, footers). */
      .mtx [data-testid^='provision-table-'] [class*='rounded'] {
        border-radius: 0 !important;
      }

      /* Section title bar → paper-2 with a 9px tracked Inter label. Only a
         GENUINE title bar (a first-child div with a direct <p> label — the
         headerNote strip, or MaeSection's card strips) gets the grey: on
         tables without one, the first child is the scroll container /
         renderBody body, and painting it grey made whole tables read grey. */
      .mtx [data-testid^='provision-table-'] > div:first-child:has(> p) {
        background: #F6F6F6;
        border-color: #E0E0E0;
      }
      .mtx [data-testid^='provision-table-'] > div:first-child:has(> p) p {
        font-family: var(--mtx-sans);
        font-size: 9px;
        font-weight: 700;
        letter-spacing: 0.14em;
        text-transform: uppercase;
        color: #6B6B6B;
      }

      /* Column headers. */
      .mtx [data-testid^='provision-table-'] thead {
        background: #F6F6F6;
        border-color: #E0E0E0;
      }
      .mtx [data-testid^='provision-table-'] thead th {
        font-family: var(--mtx-sans);
        font-size: 9px;
        font-weight: 700;
        letter-spacing: 0.14em;
        text-transform: uppercase;
        color: #6B6B6B;
        background: #F6F6F6;
      }

      /* Body cells: 12px ink (the Affirmative-covenants "value" size —
         GroupedSubRows' text-xs row values — is the standard for every
         table's content), #E0E0E0 row rules, EXPLICIT white body (grey
         lives only on thead/title bars), paper-2 hover. */
      .mtx [data-testid^='provision-table-'] table {
        font-size: 12px;
        color: #1F1F1F;
        background: #FFFFFF;
      }
      .mtx [data-testid^='provision-table-'] td {
        border-color: #E0E0E0;
      }
      .mtx [data-testid^='provision-table-'] tbody {
        background: #FFFFFF;
      }
      .mtx [data-testid^='provision-table-'] tbody > tr {
        background: #FFFFFF;
        border-color: #E0E0E0;
      }
      .mtx [data-testid^='provision-table-'] tbody tr:hover {
        background: #F6F6F6;
      }
      /* First column reads as a LABEL (the Affirmative-covenants row-label
         size/weight — GroupedSubRows' text-[11px] font-medium). */
      .mtx [data-testid^='provision-table-'] tbody > tr > td:first-child {
        font-size: 11px;
        font-weight: 500;
        color: #1F1F1F;
      }

      /* ── Multi-table sections: no outer card ─────────────────────────────
         Sections whose ProvisionTable wraps SEVERAL inner sub-cards — the
         grouped-sub-rows families (ioc-exceptions, nosol, conditions,
         termination-rights) and the composed renderBody families (Company +
         Parent representations) — drop the single big outer bordered card;
         each inner sub-card carries its own 1px #E0E0E0 border, white bg and
         a 14px vertical gap. Single-table sections keep the card look. */
      .mtx [data-testid^='provision-table-']:has([data-testid='grouped-sub-rows']),
      .mtx [data-testid^='provision-table-']:has(> [data-testid^='provision-table-body-']) {
        border: 0 !important;
        background: transparent !important;
      }
      /* renderBody path (reps): strip the p-3 body padding; the body's
         direct sub-blocks (General Exceptions box, Knowledge box, the
         per-rep table wrapper) become the bordered cards. */
      .mtx [data-testid^='provision-table-'] > [data-testid^='provision-table-body-'] {
        padding: 0;
      }
      .mtx [data-testid^='provision-table-'] > [data-testid^='provision-table-body-'] > div > div {
        border: 1px solid #E0E0E0;
        background: #FFFFFF;
        border-radius: 0;
      }
      .mtx [data-testid^='provision-table-'] > [data-testid^='provision-table-body-'] > div > div + div {
        margin-top: 14px;
      }
      /* Sub-card label strips (sectionBox headers) → same grey header voice. */
      .mtx [data-testid^='provision-table-'] > [data-testid^='provision-table-body-'] > div > div > div:first-child {
        background: #F6F6F6;
        border-color: #E0E0E0;
        font-family: var(--mtx-sans);
        font-size: 9px;
        font-weight: 700;
        letter-spacing: 0.14em;
        text-transform: uppercase;
        color: #6B6B6B;
      }
      /* Grouped path (ioc/nosol/conditions/termination-rights): the single
         body cell loses its padding and its whole-body hover; the group
         cards inside get the borders/gaps. */
      .mtx [data-testid^='provision-table-']:has([data-testid='grouped-sub-rows']) > div > table > tbody > tr > td {
        padding: 0;
      }
      .mtx [data-testid^='provision-table-']:has([data-testid='grouped-sub-rows']) > div > table > tbody > tr:hover {
        background: #FFFFFF;
      }
      .mtx [data-testid='grouped-sub-rows'] > div {
        border: 1px solid #E0E0E0;
        background: #FFFFFF;
        border-radius: 0;
      }
      .mtx [data-testid='grouped-sub-rows'] > div + div {
        margin-top: 14px;
      }
      .mtx [data-testid='grouped-sub-rows'] > div > div:first-child {
        background: #F6F6F6;
        border-color: #E0E0E0;
        font-family: var(--mtx-sans);
        font-size: 9px;
        font-weight: 700;
        letter-spacing: 0.14em;
        text-transform: uppercase;
        color: #6B6B6B;
      }
      /* Footer strips (coverage counts) in outer-card-less sections stand
         alone as their own bordered strip. */
      .mtx [data-testid^='provision-table-']:has([data-testid='grouped-sub-rows']) [data-testid^='provision-table-footer-'],
      .mtx [data-testid^='provision-table-']:has(> [data-testid^='provision-table-body-']) [data-testid^='provision-table-footer-'] {
        display: block;
        border: 1px solid #E0E0E0;
        background: #FFFFFF;
        margin-top: 14px;
      }
      /* Grid rows inside group cards: let 1fr content columns shrink so
         wrapped pills stay inside the card. */
      .mtx [data-testid='grouped-sub-rows'] .grid > * {
        min-width: 0;
      }

      /* ── Uniform first column ─────────────────────────────────────────────
         14rem (224px) = the reps TERM column, the reference width. Applied to
         the simple term/provision tables so their label columns line up page
         to page; content-heavy tables (equity awards, material contracts,
         conditions, IOC, no-sol, employee benefits) keep natural widths.
         Long labels simply wrap. */
      .mtx #sec-structure-mechanics table > thead > tr > th:first-child,
      .mtx #sec-structure-mechanics table > tbody > tr > td:first-child,
      .mtx #sec-consideration-hero table > thead > tr > th:first-child,
      .mtx #sec-consideration-hero table > tbody > tr > td:first-child,
      .mtx #sec-antitrust-regulatory table > thead > tr > th:first-child,
      .mtx #sec-antitrust-regulatory table > tbody > tr > td:first-child,
      .mtx #sec-termination-fees table > thead > tr > th:first-child,
      .mtx #sec-termination-fees table > tbody > tr > td:first-child,
      .mtx #sec-tail-fee table > thead > tr > th:first-child,
      .mtx #sec-tail-fee table > tbody > tr > td:first-child,
      .mtx #sec-misc-boilerplate table > thead > tr > th:first-child,
      .mtx #sec-misc-boilerplate table > tbody > tr > td:first-child,
      .mtx #sec-votes-approvals-meeting table > thead > tr > th:first-child,
      .mtx #sec-votes-approvals-meeting table > tbody > tr > td:first-child,
      .mtx #sec-no-other-reps-fraud table > thead > tr > th:first-child,
      .mtx #sec-no-other-reps-fraud table > tbody > tr > td:first-child {
        width: 14rem;
        min-width: 14rem;
        max-width: 14rem;
      }
      /* Below the sm breakpoint 14rem (224px) eats over half a 375px
         viewport, forcing the value column into unreadable character-by-
         character wrapping. Relax to 9rem so the value column keeps most
         of the width; labels simply wrap onto more lines. */
      @media (max-width: 639px) {
        .mtx #sec-structure-mechanics table > thead > tr > th:first-child,
        .mtx #sec-structure-mechanics table > tbody > tr > td:first-child,
        .mtx #sec-consideration-hero table > thead > tr > th:first-child,
        .mtx #sec-consideration-hero table > tbody > tr > td:first-child,
        .mtx #sec-antitrust-regulatory table > thead > tr > th:first-child,
        .mtx #sec-antitrust-regulatory table > tbody > tr > td:first-child,
        .mtx #sec-termination-fees table > thead > tr > th:first-child,
        .mtx #sec-termination-fees table > tbody > tr > td:first-child,
        .mtx #sec-tail-fee table > thead > tr > th:first-child,
        .mtx #sec-tail-fee table > tbody > tr > td:first-child,
        .mtx #sec-misc-boilerplate table > thead > tr > th:first-child,
        .mtx #sec-misc-boilerplate table > tbody > tr > td:first-child,
        .mtx #sec-votes-approvals-meeting table > thead > tr > th:first-child,
        .mtx #sec-votes-approvals-meeting table > tbody > tr > td:first-child,
        .mtx #sec-no-other-reps-fraud table > thead > tr > th:first-child,
        .mtx #sec-no-other-reps-fraud table > tbody > tr > td:first-child {
          width: 9rem;
          min-width: 9rem;
          max-width: 9rem;
        }
      }

      /* Pills → sharp rectangles, 12px medium Inter (pill text is table
         VALUE content, same size as every other value cell), sentence case
         as authored (NO uppercase transform — header rows and meta labels
         keep theirs via .mtx-meta-label / the thead rules). */
      .mtx [data-testid^='provision-table-'] span.inline-flex.border {
        border-radius: 0 !important;
        font-family: var(--mtx-sans);
        font-size: 12px;
        font-weight: 500;
        text-transform: none;
        letter-spacing: 0.01em;
        max-width: 100%;
        min-width: 0;
      }
      /* Pills wrap instead of truncating/escaping: PillCell's inner span is
         .truncate (white-space:nowrap), which gives the pill an
         unshrinkable min-content width equal to its full single-line text —
         long labels (e.g. the nosol "Yes — if it concurrently signs…" pill)
         painted past their cell. Let the text wrap inside the pill. */
      .mtx [data-testid^='provision-table-'] span.inline-flex.border > span {
        white-space: normal;
        overflow-wrap: break-word;
        word-break: break-word;
        overflow: visible;
        text-overflow: clip;
        min-width: 0;
      }
      /* Flex pill-list cells: children may shrink below content width. */
      .mtx [data-testid^='provision-table-'] .flex.flex-wrap > * {
        min-width: 0;
      }

      /* Muted approximate-period suffix on lookback pills ("(≈8 mos)"). */
      .mtx .mtx-approx {
        font-size: 10px;
        font-weight: 400;
        color: #6B6B6B;
        text-transform: none;
        letter-spacing: normal;
        white-space: nowrap;
      }

      /* ── Colour homogenisation: colour = strength, everywhere ────────────
         The reused configs colour pills through the Tailwind
         border-X-200 / bg-X-50 / text-X-800 ladder (PILL_TONES,
         STANDARD_COLORS, plus stray -100/-300/-700/-900 variants in
         shared.js chips and the -400 family dots). Within .mtx those raw
         utility classes are remapped onto ONE semantic strength palette —
         text at full colour, background at ~8% alpha, border at ~25% alpha:

           GREEN  #2F6B43 — strongest / most protective standards; Yes /
                            present / no-less-favourable / all-respects.
                            (emerald-*, plus stray green-* and lime-* chips)
           TEAL   #2F8B7E — strict second tier: de minimis, substantially
                            comparable. (teal-*)
           BLUE   #2F6DB5 — mid standards: RBE, in-all-material-respects,
                            comparable; info pills. (sky-*, blue-*, and
                            violet-* [best efforts] COLLAPSED into the same
                            blue — one mid tier, one colour)
           AMBER  #A87A2E — loose / MAE-level qualifiers, CRE, warnings.
                            (amber-*, orange-*)
           ROSE   #B14E63 — adverse / red-flag chips. (rose-*, red-*)
           GREY   #4A4A4A — ungraded facts; full-ink text is too heavy for
                            pills, so text #4A4A4A on bg rgba(31,31,31,.05),
                            border rgba(31,31,31,.18). (slate-*, and the
                            'neutral' tone below) */

      /* GREEN — emerald/green/lime families */
      .mtx .text-emerald-800, .mtx .text-emerald-700,
      .mtx .text-green-800, .mtx .text-green-700,
      .mtx .text-lime-800 { color: #2F6B43; }
      .mtx .bg-emerald-50, .mtx .bg-green-50, .mtx .bg-lime-50 { background-color: rgba(47, 107, 67, 0.08); }
      .mtx .border-emerald-200, .mtx .border-green-200, .mtx .border-lime-200 { border-color: rgba(47, 107, 67, 0.25); }
      .mtx .bg-emerald-400, .mtx .bg-emerald-500,
      .mtx .bg-green-400, .mtx .bg-lime-400 { background-color: #2F6B43; }

      /* TEAL — de minimis / substantially comparable tier */
      .mtx .text-teal-800, .mtx .text-teal-700 { color: #2F8B7E; }
      .mtx .bg-teal-50 { background-color: rgba(47, 139, 126, 0.08); }
      .mtx .border-teal-200 { border-color: rgba(47, 139, 126, 0.25); }
      .mtx .bg-teal-400 { background-color: #2F8B7E; }

      /* BLUE — sky/blue info + mid standards; violet (best efforts)
         collapsed into the same blue */
      .mtx .text-sky-900, .mtx .text-sky-800, .mtx .text-sky-700,
      .mtx .text-blue-800,
      .mtx .text-violet-800, .mtx .text-violet-700 { color: #2F6DB5; }
      .mtx .bg-sky-50, .mtx .bg-blue-50, .mtx .bg-violet-50 { background-color: rgba(47, 109, 181, 0.08); }
      .mtx .border-sky-200, .mtx .border-blue-200, .mtx .border-violet-200 { border-color: rgba(47, 109, 181, 0.25); }
      .mtx .decoration-sky-300 { text-decoration-color: rgba(47, 109, 181, 0.4); }
      .mtx .bg-sky-400, .mtx .bg-blue-400, .mtx .bg-violet-400 { background-color: #2F6DB5; }

      /* AMBER — loose/MAE-level qualifiers, CRE, warnings (+ orange) */
      .mtx .text-amber-900, .mtx .text-amber-800, .mtx .text-amber-700,
      .mtx .text-amber-600, .mtx .text-amber-500,
      .mtx .text-orange-800 { color: #A87A2E; }
      .mtx .bg-amber-50, .mtx .bg-amber-100, .mtx .bg-orange-50 { background-color: rgba(168, 122, 46, 0.08); }
      .mtx .border-amber-200, .mtx .border-amber-300, .mtx .border-amber-400,
      .mtx .border-orange-200 { border-color: rgba(168, 122, 46, 0.25); }
      .mtx .bg-amber-400, .mtx .bg-amber-500, .mtx .bg-amber-600, .mtx .bg-amber-700,
      .mtx .bg-orange-400 { background-color: #A87A2E; }

      /* ROSE — adverse / red-flag chips (rose + red) */
      .mtx .text-rose-800, .mtx .text-rose-700,
      .mtx .text-red-800, .mtx .text-red-700, .mtx .text-red-600 { color: #B14E63; }
      .mtx .bg-rose-50, .mtx .bg-red-50 { background-color: rgba(177, 78, 99, 0.08); }
      .mtx .border-rose-200, .mtx .border-red-200 { border-color: rgba(177, 78, 99, 0.25); }
      .mtx .bg-rose-400, .mtx .bg-red-400 { background-color: #B14E63; }

      /* GREY — slate family */
      .mtx .text-slate-700, .mtx .text-slate-600 { color: #4A4A4A; }
      .mtx .bg-slate-100, .mtx .bg-slate-50 { background-color: rgba(31, 31, 31, 0.05); }
      .mtx .border-slate-300, .mtx .border-slate-200 { border-color: rgba(31, 31, 31, 0.18); }

      /* GREY — the 'neutral' pill tone (border-border bg-bg text-ink):
         scoped to pill spans so ordinary text-ink copy keeps full ink. */
      .mtx span.inline-flex.border.text-ink {
        color: #4A4A4A;
        background-color: rgba(31, 31, 31, 0.05);
        border-color: rgba(31, 31, 31, 0.18);
      }

      /* Evidence hover popover (HoverSource renders a fixed
         span[role='tooltip']): restyled from washed amber to the design's
         citation voice — solid white, fully opaque, 1px rule border with a
         2px ink left rule (the prototype's source-quote motif), Tinos serif
         ink text. Must beat the 8% amber tint remap above. */
      .mtx span[role='tooltip'] {
        background-color: #FFFFFF !important;
        border: 1px solid #E0E0E0 !important;
        border-left: 2px solid #1F1F1F !important;
        border-radius: 0 !important;
        box-shadow: 0 2px 10px rgba(31, 31, 31, 0.12) !important;
        color: #1F1F1F !important;
        /* Ben (round 2): same voice as the "see provision" expansion —
           sans 12px, not serif. */
        font-family: var(--mtx-sans) !important;
        font-size: 12px !important;
        line-height: 1.6 !important;
      }
      .mtx span[role='tooltip'] strong {
        color: #1F1F1F;
        background: rgba(47, 109, 181, 0.12);
        font-weight: 700;
      }

      /* Open "see text" content spans the row: the details lives inside a
         (narrow) cell, so the revealed body becomes a bordered flyout panel
         that grows the row's height in-flow but paints across the full row
         width instead of wrapping inside the label column. Stays inside the
         table's box (no clash with the overflow-x clip). */
      .mtx [data-testid^='provision-table-'] td details[open] > div {
        width: min(36rem, 76vw);
        max-width: none;
        background: #FFFFFF;
        border: 1px solid #E0E0E0;
        border-left: 2px solid #1F1F1F;
        padding: 8px 10px;
        position: relative;
        z-index: 5;
      }

      /* "see text" expander + footers pick the Mergertrace meta voice. */
      /* Ben (round 2): less prominent — smaller, lighter, greyer. */
      .mtx .term-cell-seetext {
        font-family: var(--mtx-sans);
        font-weight: 600;
        font-size: 8px;
        letter-spacing: 0.08em;
        text-transform: uppercase;
        color: #9A9A9A;
      }
      .mtx .term-cell-seetext:hover { color: #1F1F1F; }
      /* The expander's revealed body is VALUE content (the full clause
         text) — same 12px as every other value cell, not the 11px the
         reused ProvisionTable/MaeSection markup ships (text-[11px]). */
      .mtx [data-testid^='provision-table-'] details > div {
        font-size: 12px;
      }
      .mtx [data-testid^='coverage-footer'],
      .mtx [data-testid^='provision-table-footer-'] {
        border-color: #E0E0E0;
      }

      /* Collapsible sections: hide the default marker, rotate the caret
         when closed. */
      .mtx details.mtx-section > summary::-webkit-details-marker { display: none; }
      .mtx details.mtx-section:not([open]) .mtx-section-caret { transform: rotate(-90deg); }
      .mtx details.mtx-section > summary:hover h2 { color: #000; }

      /* ── Generic .mtx primitives (WP-2 / M4-04 + M5-01 remnant) ──────────
         Standalone table/input/button/badge/drawer primitives for pages
         built fresh on .mtx (the query UI, and future admin/query pages)
         rather than re-skinning reused v1 markup by testid. Reuse the
         existing custom properties only — no new color/spacing/type
         values introduced here. */

      .mtx .mtx-table { width: 100%; border-collapse: collapse; font-family: var(--mtx-sans); font-size: 12px; background: #FFFFFF; border: 1px solid #E0E0E0; }
      .mtx .mtx-table th, .mtx .mtx-table td { border-bottom: 1px solid #E0E0E0; padding: 10px 12px; text-align: left; vertical-align: top; }
      .mtx .mtx-table thead th {
        background: #F6F6F6;
        font-family: var(--mtx-sans);
        font-size: 9px;
        font-weight: 700;
        letter-spacing: 0.14em;
        text-transform: uppercase;
        color: #6B6B6B;
        border-color: #E0E0E0;
      }
      .mtx .mtx-table tbody tr { background: #FFFFFF; }
      .mtx .mtx-table tbody tr:hover { background: #F6F6F6; }
      .mtx .mtx-table td.mtx-mono, .mtx .mtx-table th.mtx-mono { font-family: var(--mtx-mono); font-variant-numeric: tabular-nums; }
      .mtx .mtx-table tbody tr td:first-child { font-weight: 500; }

      .mtx .mtx-input, .mtx .mtx-select, .mtx textarea.mtx-input {
        font-family: var(--mtx-sans);
        font-size: 13px;
        color: #1F1F1F;
        background: #FFFFFF;
        border: 1px solid #E0E0E0;
        border-radius: 0;
        height: 36px;
        padding: 0 10px;
      }
      .mtx textarea.mtx-input { height: auto; padding: 8px 10px; line-height: 1.5; }
      .mtx .mtx-input::placeholder { color: #9A9A9A; }
      .mtx .mtx-input:focus, .mtx .mtx-select:focus {
        outline: none;
        border-color: #1F1F1F;
      }
      .mtx label.mtx-meta-label { display: block; font-size: 9px; margin-bottom: 6px; }

      .mtx .mtx-btn {
        font-family: var(--mtx-sans);
        font-size: 12px;
        font-weight: 600;
        color: #1F1F1F;
        background: #FFFFFF;
        border: 1px solid #E0E0E0;
        border-radius: 0;
        height: 34px;
        padding: 0 14px;
        display: inline-flex;
        align-items: center;
        gap: 6px;
        cursor: pointer;
        text-decoration: none;
      }
      .mtx .mtx-btn:hover { background: #F6F6F6; }
      .mtx .mtx-btn:disabled { opacity: 0.4; cursor: not-allowed; }
      .mtx .mtx-btn-primary {
        background: #1F1F1F;
        color: #FFFFFF;
        border-color: #1F1F1F;
      }
      .mtx .mtx-btn-primary:hover { background: #000000; }

      .mtx .mtx-badge {
        display: inline-flex;
        align-items: center;
        font-family: var(--mtx-sans);
        font-size: 10px;
        font-weight: 700;
        letter-spacing: 0.06em;
        text-transform: uppercase;
        color: #4A4A4A;
        background: rgba(31, 31, 31, 0.05);
        border: 1px solid rgba(31, 31, 31, 0.18);
        border-radius: 0;
        padding: 3px 7px;
      }
      .mtx .mtx-badge-mono { font-family: var(--mtx-mono); text-transform: none; letter-spacing: 0; }

      .mtx .mtx-drawer {
        position: fixed;
        top: 0;
        right: 0;
        bottom: 0;
        width: min(520px, 92vw);
        background: #FFFFFF;
        border-left: 1px solid #E0E0E0;
        box-shadow: -18px 0 60px rgba(31, 31, 31, 0.16);
        z-index: 40;
        padding: 22px;
        overflow: auto;
        font-family: var(--mtx-sans);
      }
      .mtx .mtx-drawer-backdrop {
        position: fixed;
        inset: 0;
        background: rgba(31, 31, 31, 0.28);
        z-index: 39;
      }

      /* ── SourceOverlay (WP-5 / M5-03) — full-doc overlay, exact span highlight ── */
      .mtx-source-overlay-backdrop {
        position: fixed;
        inset: 0;
        background: rgba(31, 31, 31, 0.5);
        z-index: 50;
        display: flex;
        align-items: stretch;
        justify-content: center;
      }
      .mtx-source-overlay {
        display: flex;
        flex-direction: column;
        width: 100%;
        max-width: 920px;
        margin: 0 auto;
        background: #FFFFFF;
        box-shadow: 0 0 60px rgba(0, 0, 0, 0.3);
      }
      .mtx-source-overlay-header {
        display: flex;
        align-items: flex-start;
        justify-content: space-between;
        gap: 12px;
        padding: 16px 24px;
        border-bottom: 2px solid #1F1F1F;
        background: #FFFFFF;
      }
      .mtx-source-overlay-notice {
        margin: 0;
        padding: 10px 24px;
        background: rgba(177, 78, 99, 0.08);
        border-bottom: 1px solid rgba(177, 78, 99, 0.25);
        color: #B14E63;
        font-family: var(--mtx-sans);
        font-size: 11px;
        line-height: 1.5;
      }
      .mtx-source-overlay-body {
        flex: 1;
        min-height: 0;
        overflow-y: auto;
        padding: 24px 32px 48px;
        background: #FFFFFF;
      }
      .mtx-doc-pane {
        font-family: var(--mtx-serif);
        font-size: 13.5px;
        line-height: 1.75;
        color: #1F1F1F;
        white-space: pre-wrap;
        word-break: break-word;
        margin: 0;
      }
      .mtx-doc-highlight {
        background: #FDE68A;
        box-shadow: 0 0 0 3px #FDE68A;
        border-radius: 2px;
        color: inherit;
        scroll-margin: 96px;
      }
      .mtx-source-overlay-footer {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 12px;
        padding: 8px 24px;
        border-top: 1px solid #E0E0E0;
        background: #F6F6F6;
        font-family: var(--mtx-sans);
        font-size: 9px;
        font-weight: 700;
        text-transform: uppercase;
        letter-spacing: 0.1em;
        color: #6B6B6B;
      }
      .mtx-view-in-agreement {
        font-family: var(--mtx-sans);
        font-size: 9px;
        font-weight: 700;
        text-transform: uppercase;
        letter-spacing: 0.1em;
        color: #2F6DB5;
        background: none;
        border: none;
        padding: 0;
        cursor: pointer;
      }
      .mtx-view-in-agreement:hover {
        text-decoration: underline;
      }

      /* Full-bleed: neutralise the app Layout's padded grey canvas on this
         page only (the .mtx root sits directly inside Layout's <main>). */
      main:has(> .mtx) {
        padding: 0 !important;
      }
      .bg-paper:has(.mtx) {
        background: #FFFFFF !important;
      }
      /* Let the app's own top bar scroll away so the Mergertrace masthead is
         the only sticky header (it pins at top-0, mirroring the prototype). */
      .bg-paper:has(.mtx) > header {
        position: static !important;
      }
    `}</style>
  );
}
