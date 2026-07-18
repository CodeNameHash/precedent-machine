import * as ProvisionTablePrimitives from './primitives/ProvisionTablePrimitives';

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
const FULL_TEXT_COLUMNS = {
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

function SeeTextExpander({ children }) {
  return (
    <details className="mt-1">
      <summary className="term-cell-seetext" style={{ listStyle: 'none' }}>
        See provision
      </summary>
      <div className="mt-1 max-w-[42rem] whitespace-pre-wrap break-words text-[11px] leading-5 text-inkLight">
        {children}
      </div>
    </details>
  );
}

export default function ProvisionTable({ config, reviewDeal, isEdit = false }) {
  if (!config || typeof config.selectRows !== 'function') return null;
  const rows = config.selectRows(reviewDeal);
  if (!Array.isArray(rows) || rows.length === 0) return null;
  // Opt-in escape hatch for families whose rows don't map onto ONE flat
  // <table> (e.g. mae-definitions splitting Company vs Parent MAE into two
  // separate <table> sub-sections, matching the legacy per-side render).
  // config.selectRows keeps returning its normal flat row list -- unit tests
  // and hasRows checks elsewhere still see the real per-row data -- only the
  // body markup is swapped out here.
  if (typeof config.renderBody === 'function') {
    const bodyCtx = { reviewDeal, config, primitives: ProvisionTablePrimitives, isEdit };
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
                {columns.map((column) => (
                  <th
                    key={column.id}
                    className="px-3 py-2 text-left font-medium uppercase tracking-wider text-inkFaint"
                    style={column.width ? { width: column.width } : undefined}
                  >
                    {column.header}
                  </th>
                ))}
              </tr>
            </thead>
          ) : null}
          <tbody className="divide-y divide-border">
            {rows.map((row) => {
              const fullTextNodes = fullTextColumns
                .map((column) => (column.renderCell ? column.renderCell(row, ctx) : null))
                .filter(Boolean);
              return (
                <tr key={row.id || row.label} className={row.present ? 'align-top hover:bg-bg/40' : 'align-top bg-bg/30 text-inkFaint'}>
                  {columns.map((column, colIdx) => (
                    <td key={`${row.id || row.label}-${column.id}`} className="px-3 py-2 whitespace-pre-wrap break-words text-ink">
                      {column.renderCell ? column.renderCell(row, ctx) : null}
                      {colIdx === 0 && fullTextNodes.length > 0 ? (
                        <SeeTextExpander>{fullTextNodes}</SeeTextExpander>
                      ) : null}
                    </td>
                  ))}
                </tr>
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
