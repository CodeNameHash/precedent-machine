import { Fragment, useState } from 'react';
import * as ProvisionTablePrimitives from './primitives/ProvisionTablePrimitives';
import { buildCardIndex, resolveRowCard, resolveRowFocus } from '../review-v2/provisionIndexHelpers.js';
import { headerLines } from './table-configs/card-utils.js';

/*
Config shape:
{
  id: string,
  title: string,
  layoutSlot: string,
  selectRows: (reviewDeal) => rows[],
  columns: [{ id: string, header: string, renderCell: (row, ctx) => ReactNode, width?: string }],
  empty?: { copy: string },
}
*/

// Phase A shell-restore (AC4): columns that dump the full provision clause
// text inline (raw primary_quote / region_full_text / structured detail
// lines). These are pulled OUT of the always-visible grid and relocated
// behind a per-row "see text" expander on the first column, matching the
// dc46bef "see text" affordance. Keyed by (config.id -> [column.id]) so we
// never touch the legitimate short feature/pill columns that happen to share
// a column id (e.g. 'detail') across families.
// Exported for compare mode's unified section table (CompareColumn.jsx),
// which applies the SAME relocation so per-deal answer cells match what
// each deal's own table would have shown inline.
export const FULL_TEXT_COLUMNS = {
  'conditions-m': ['provision'],
  'conditions-b': ['provision'],
  'conditions-s': ['provision'],
  'material-contracts': ['evidence'],
  'tail-fee': ['evidence'],
  'employee-benefits': ['detail'],
  'no-other-reps-fraud': ['detail'],
  // Phase B compact-column reshaping. These families all share one shape:
  // every row's 'signals' pill already embeds the same readable value the
  // 'detail' column repeats in full, un-truncated prose (see each config's
  // signalFor()/withSignal() — the pill label is literally `${kind}:
  // ${value}`). Relocating 'detail' loses nothing visible; it's a verbatim
  // second copy of what the pill already shows, just wider and unbounded.
  'mae-definitions': ['detail'],
  'antitrust-regulatory': ['detail'],
  'representations-qualifiers': ['detail'],
  'structure-mechanics': ['detail'],
  'sec-meeting': ['detail'],
  'nosol-noshop': ['detail'],
  'nosol-intervening': ['detail'],
  // FEEDBACK-2-PUNCHLIST.md item 46: the un-truncated 'detail' column (full
  // governing-law/forum clause text, assignment restrictions, the
  // third-party-beneficiaries carve-out summary) was what made this table
  // read too wide. Same shape as the families above -- 'signals' pills
  // already carry the readable value.
  'misc-boilerplate': ['detail'],
};

// Sidebar feedback package (Ben, r5), item 4: "See provision" used to be a
// <details> nested inside the row's first <td>, so its expanded content was
// squeezed into that one column's width (max-w-[42rem] was a band-aid for
// that, not a real fix) -- it visibly distorted the table. Now it's a plain
// toggle button in the first cell; the expanded text renders in a SEPARATE
// full-width <tr><td colSpan={columns.length}> immediately below the row,
// so the table's own column layout is never touched by what's inside the
// expansion. Only one row expands at a time (expandedRowId in the component
// below) -- clicking another row's toggle (or the same one again) closes it.
function SeeProvisionToggle({ open, onToggle }) {
  return (
    <button
      type="button"
      className="term-cell-seetext mt-1 block"
      style={{ listStyle: 'none' }}
      onClick={(e) => { e.stopPropagation(); onToggle(); }}
      aria-expanded={open}
    >
      {open ? 'Hide provision' : 'See provision'}
    </button>
  );
}

// R6 item 2: configs with their own custom renderBody (reps, MAE, conditions
// -- anything that doesn't go through the generic <tr> loop below) were each
// growing their own bespoke in-cell <details> expansion, squeezed into
// whichever column happened to hold the toggle -- the exact "distorts the
// table" defect the generic path's colSpan expansion (below) was built to
// fix. These two are exported so any renderBody config can reuse the SAME
// full-width expansion row instead of reinventing an in-cell one: a config
// renders <SeeProvisionToggle> in its label cell (wired to
// ctx.expandedRowId/ctx.setExpandedRowId, threaded onto bodyCtx below) and,
// immediately below that row, an <ExpansionRow> spanning every column.
function ExpansionRow({ rowKey, colSpan, children }) {
  if (!children) return null;
  return (
    <tr key={`${rowKey}-expansion`} className="mtx-provision-expansion-row bg-bg/20">
      <td colSpan={colSpan} className="px-3 py-3 border-t border-dashed border-border">
        <div className="max-w-none whitespace-pre-wrap break-words text-[11px] leading-5 text-inkLight">
          {children}
        </div>
      </td>
    </tr>
  );
}

// Companion to ExpansionRow's full text: renders the sub-fact/portion that a
// pill or column is actually keyed off (e.g. the SEC-filings cut-off phrase)
// as a labelled, highlighted callout BENEATH the full clause text -- so the
// reader sees the whole provision AND which portion the row's pill is
// pointing at, rather than the portion standing in for the whole provision
// (r6 item 1b).
function PortionExcludedNote({ label = 'Portion excluded', text }) {
  if (!text) return null;
  return (
    <div className="mt-2 rounded border border-amber-200 bg-amber-50 px-2 py-1.5">
      <div className="text-[10px] font-medium uppercase tracking-wide text-amber-700">{label}</div>
      <div className="mt-0.5 text-[11px] leading-5 text-amber-900">{text}</div>
    </div>
  );
}

// Item 8: a row's provision text used to reach the reader through whatever
// ad-hoc affordance its own renderCell happened to wire up -- a right-column
// TruncatedWithSeeText/ClampedWithSeeText, a mouse-over-only HoverSource
// with no click-through, or (for FULL_TEXT_COLUMNS families) the left-column
// expander above. Rows with only pills (equity-awards, termination-fees,
// votes deadlines, ...) exposed the clause ONLY via the hover popover, which
// is being killed in this same pass. This is the universal fallback: any
// row whose renderCell(s) produced no fullTextNodes but DOES carry evidence
// (an explicit row.evidence string, else the source card's own text) still
// gets the SAME left-column "See provision" expander every other family
// gets -- one consistent place to find the underlying provision, everywhere.
function textOfSourceCard(card) {
  return String(card?.primary_quote || card?.region_full_text || '').trim();
}
function fallbackEvidenceText(row, resolvedCard = null) {
  if (typeof row?.evidence === 'string' && row.evidence.trim()) return row.evidence.trim();
  const objectSource = row?.source && typeof row.source === 'object' ? row.source : null;
  const source = resolvedCard || row?.sourceCard || objectSource || row?.card
    || (Array.isArray(row?.sourceCards) ? row.sourceCards[0] : null);
  return textOfSourceCard(source) || null;
}

export default function ProvisionTable({ config, reviewDeal, isEdit = false, sectionCards = null, onSelectCard = null, selectedCardId = null }) {
  // Item 4 (r5): tracks which row's "See provision" expansion is open, keyed
  // by row.id||row.label -- must be called unconditionally (rules of hooks),
  // ahead of the early-return guards below.
  const [expandedRowId, setExpandedRowId] = useState(null);
  if (!config || typeof config.selectRows !== 'function') return null;
  const rows = config.selectRows(reviewDeal);
  if (!Array.isArray(rows) || rows.length === 0) return null;
  // Item 17 (r4): the same source-card resolution the ProvisionIndex
  // "see provision" evidence path uses (provisionIndexHelpers.js), reused
  // here so a summary-row click opens the ClauseSidebar for the CARD that
  // backs it -- see resolveRowCard()'s doc comment for the row shapes it
  // reads. cardsById is scoped to THIS section's own card list, matching the
  // spec's "find the matching card from the section's cards".
  const cardsById = buildCardIndex(sectionCards);
  const resolveCard = (row) => (onSelectCard ? resolveRowCard(row, cardsById) : null);
  // Opt-in escape hatch for families whose rows don't map onto ONE flat
  // <table> (e.g. mae-definitions splitting Company vs Parent MAE into two
  // separate <table> sub-sections, matching the legacy per-side render).
  // config.selectRows keeps returning its normal flat row list -- unit tests
  // and hasRows checks elsewhere still see the real per-row data -- only the
  // body markup is swapped out here.
  if (typeof config.renderBody === 'function') {
    const bodyCtx = { reviewDeal, config, primitives: ProvisionTablePrimitives, isEdit };
    bodyCtx.resolveCard = resolveCard;
    bodyCtx.onSelectCard = onSelectCard;
    bodyCtx.selectedCardId = selectedCardId;
    // R6 item 2: same expandedRowId/setExpandedRowId the generic path below
    // uses for its full-width colSpan expansion -- threaded onto bodyCtx so
    // a config's own renderBody can reuse SeeProvisionToggle/ExpansionRow
    // instead of building its own in-cell <details> expansion.
    bodyCtx.expandedRowId = expandedRowId;
    bodyCtx.setExpandedRowId = setExpandedRowId;
    bodyCtx.SeeProvisionToggle = SeeProvisionToggle;
    bodyCtx.ExpansionRow = ExpansionRow;
    bodyCtx.PortionExcludedNote = PortionExcludedNote;
    const headerNote = typeof config.deriveHeaderNote === 'function' ? config.deriveHeaderNote(rows) : null;
    // R3/G-TITLE: config.title already renders once as the collapsible
    // section <h2> in pages/review/[id].js (same rule as the generic path's
    // showTitleStrip=false below) -- this strip must never repeat it, and
    // only survives to carry a headerNote when one is present.
    return (
      <section data-testid={`provision-table-${config.id}`} className="rounded border border-border bg-white shadow-sm">
        {headerNote ? (
          <div className="border-b border-border bg-bg/60 px-3 py-2 flex items-center justify-between gap-3">
            <span />
            <p className="font-ui text-[10px] font-medium text-inkFaint whitespace-nowrap">{headerNote}</p>
          </div>
        ) : null}
        <div data-testid={`provision-table-body-${config.id}`} className="p-3 space-y-4">
          {config.renderBody(rows, bodyCtx)}
        </div>
        {typeof config.renderFooter === 'function' ? (
          <div data-testid={`provision-table-footer-${config.id}`}>
            {config.renderFooter(rows, bodyCtx)}
          </div>
        ) : null}
      </section>
    );
  }
  const allColumns = Array.isArray(config.columns) ? config.columns : [];
  const fullTextIds = FULL_TEXT_COLUMNS[config.id] || [];
  const columns = allColumns.filter((column) => !fullTextIds.includes(column.id));
  const fullTextColumns = allColumns.filter((column) => fullTextIds.includes(column.id));
  const ctx = { reviewDeal, config, primitives: ProvisionTablePrimitives };
  // isEdit flows into ctx so per-family renderCells can suppress edit-only
  // affordances (e.g. raw canonical-code pills) in the default Reviewer view.
  ctx.isEdit = isEdit;
  // Item 17 (r4): custom renderCell paths (e.g. nosol-section.config.js's
  // GroupedSubRows body) get the same resolver/selection wiring the generic
  // <tr> loop below uses, so a config that threads `card`/`sourceCard`/
  // `sourceCards` onto its own row shape can wire its own click affordance.
  ctx.resolveCard = resolveCard;
  ctx.onSelectCard = onSelectCard;
  ctx.selectedCardId = selectedCardId;
  // Grouped/consolidated tables (termination rights, conditions, equity
  // awards) render a single header-less column whose cell owns its own
  // internal layout (e.g. GroupedSubRows). Suppress the generic <thead> bar
  // entirely rather than showing an empty header row above it.
  const showHeader = columns.some((column) => column.header);
  // Optional short subtitle next to the section title -- used to hoist a
  // value that's identical on every row (e.g. the no-shop obligor) out of a
  // repeated per-row column and into the section chrome instead.
  const headerNote = typeof config.deriveHeaderNote === 'function' ? config.deriveHeaderNote(rows) : null;
  // config.title already renders once as the collapsible section <h2> in
  // pages/review/[id].js -- this chrome strip used to print it a SECOND
  // time immediately below, which reads as a copy-paste duplicate (punch-
  // list #22 MAE, #23 material-contracts). Configs that don't need a
  // distinct in-table label opt out via hideRepeatedTitle; the strip still
  // renders (for headerNote) when there's something else to show.
  // Feedback G3 (global): the collapsible section <h2> already shows the title,
  // so the in-table strip repeating it always reads as a copy-paste duplicate.
  // Never render it; the strip survives only to carry a headerNote when present.
  const showTitleStrip = false;

  return (
    <section data-testid={`provision-table-${config.id}`} className="rounded border border-border bg-white shadow-sm">
      {(showTitleStrip || headerNote) ? (
        <div className="border-b border-border bg-bg/60 px-3 py-2 flex items-center justify-between gap-3">
          {showTitleStrip ? (
            <p className="font-ui text-[10px] font-medium uppercase tracking-wider text-inkFaint">
              {config.title}
            </p>
          ) : <span />}
          {headerNote ? (
            <p className="font-ui text-[10px] font-medium text-inkFaint whitespace-nowrap">{headerNote}</p>
          ) : null}
        </div>
      ) : null}
      <div className="overflow-x-auto">
        <table className={`min-w-full text-xs font-ui${config.fixedLayout ? ' table-fixed' : ''}`}>
          {config.fixedLayout ? (
            <colgroup>
              {columns.map((column) => (
                <col
                  key={`col-${column.id}`}
                  style={column.width ? { width: column.width, maxWidth: column.maxWidth } : undefined}
                />
              ))}
            </colgroup>
          ) : null}
          {showHeader ? (
            <thead className="border-b border-border bg-bg/60">
              <tr>
                {columns.map((column) => {
                  // R6 item 7: headers never show "..." -- headerLines()
                  // (card-utils.js) splits a clean "Main (qualifier)" onto
                  // two lines and drops an already-truncated qualifier
                  // entirely; the th wraps (no nowrap/truncate) so a long
                  // main label breaks across lines instead of clipping.
                  const { main, qualifier } = headerLines(column.header);
                  return (
                    <th
                      key={column.id}
                      className="px-3 py-2 text-left font-medium uppercase tracking-wider text-inkFaint whitespace-normal break-words"
                      style={column.width ? { width: column.width } : undefined}
                    >
                      {main}
                      {qualifier ? (
                        <span className="block font-normal normal-case tracking-normal text-inkFaint">{qualifier}</span>
                      ) : null}
                    </th>
                  );
                })}
              </tr>
            </thead>
          ) : null}
          <tbody className="divide-y divide-border">
            {rows.map((row) => {
              // Resolve first so rows using the compact `source` shape (and
              // rows whose source only exists in sectionCards) get both the
              // drilldown click and the universal provision-text fallback.
              const rowCard = resolveCard(row);
              const fullTextNodes = fullTextColumns
                .map((column) => (column.renderCell ? column.renderCell(row, ctx) : null))
                .filter(Boolean);
              const fallbackText = fullTextNodes.length === 0 ? fallbackEvidenceText(row, rowCard) : null;
              // Item 17 (r4): reuse the same source-card resolution
              // ProvisionIndex's "see provision" path uses -- a row only
              // becomes clickable when it resolves to an actual card, so
              // rows with no identifiable source (cross-card rollups,
              // computed-only values) never get a dead cursor-pointer.
              const rowCardKey = rowCard ? (rowCard.id || rowCard.provision_instance_id) : null;
              const isSelectedRow = Boolean(rowCardKey) && selectedCardId === rowCardKey;
              const baseRowClass = row.present ? 'align-top hover:bg-bg/40' : 'align-top bg-bg/30 text-inkFaint';
              const rowClass = rowCard ? `${baseRowClass} mtx-row-clickable` : baseRowClass;
              const rowKey = row.id || row.label;
              const hasExpansion = fullTextNodes.length > 0 || Boolean(fallbackText);
              const isExpanded = hasExpansion && expandedRowId === rowKey;
              return (
                <Fragment key={rowKey}>
                  <tr
                    className={rowClass}
                    onClick={rowCard ? () => onSelectCard(rowCard, resolveRowFocus(row)) : undefined}
                    style={rowCard ? { cursor: 'pointer', ...(isSelectedRow ? { background: 'rgba(47,109,181,.07)', boxShadow: 'inset 2px 0 0 #2F6DB5' } : {}) } : undefined}
                  >
                    {columns.map((column, colIdx) => (
                      <td key={`${rowKey}-${column.id}`} className="px-3 py-2 whitespace-pre-wrap break-words text-ink">
                        {column.renderCell ? column.renderCell(row, ctx) : null}
                        {colIdx === 0 && hasExpansion ? (
                          <SeeProvisionToggle
                            open={isExpanded}
                            onToggle={() => setExpandedRowId((cur) => (cur === rowKey ? null : rowKey))}
                          />
                        ) : null}
                      </td>
                    ))}
                  </tr>
                  {/* Item 4 (r5): the expansion is now a full-width row (colSpan
                      across every visible column) beneath the clicked row,
                      instead of a <details> squeezed into column 0 -- the
                      table's own column widths are never distorted by it. */}
                  {isExpanded ? (
                    <tr key={`${rowKey}-expansion`} className="mtx-provision-expansion-row bg-bg/20">
                      <td colSpan={columns.length} className="px-3 py-3 border-t border-dashed border-border">
                        <div className="max-w-none whitespace-pre-wrap break-words text-[11px] leading-5 text-inkLight">
                          {fullTextNodes.length > 0 ? fullTextNodes : fallbackText}
                        </div>
                      </td>
                    </tr>
                  ) : null}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
      {typeof config.renderFooter === 'function' ? (
        <div data-testid={`provision-table-footer-${config.id}`}>
          {config.renderFooter(rows, ctx)}
        </div>
      ) : null}
    </section>
  );
}
